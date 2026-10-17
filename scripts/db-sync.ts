/**
 * Copies the public card catalog, rules and latest prices of an OpenRift
 * instance (`CATALOG_SOURCE_URL`) into a local database, and updates them on
 * later runs. See "Card data" in docs/development.md.
 *
 * Usage: bun db:sync [--yes]
 */
import type { Kysely } from "kysely";
import type { z } from "zod";

import {
  readSyncState,
  writeCatalogSync,
  writePricesSync,
  writeRulesSync,
} from "../apps/api/src/db/catalog-sync-writer.js";
import type { SyncState } from "../apps/api/src/db/catalog-sync-writer.js";
import {
  buildCatalogSync,
  buildPricesSync,
  buildRulesSync,
} from "../apps/api/src/db/catalog-sync.js";
import { createDb } from "../apps/api/src/db/connect.js";
import type { Database } from "../apps/api/src/db/tables.js";
import { catalogResponseSchema } from "../packages/shared/src/contracts/catalog.js";
import { initResponseSchema } from "../packages/shared/src/contracts/init.js";
import {
  marketplaceInfoResponseSchema,
  pricesResponseSchema,
} from "../packages/shared/src/contracts/prices.js";
import {
  rulesListResponseSchema,
  ruleVersionsListResponseSchema,
} from "../packages/shared/src/contracts/rules.js";
import { createLogger } from "../packages/shared/src/logger.js";
import { requireEnv } from "./env.js";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
// The API caps `/prices/marketplace-info` at 200 printings per request.
const INFO_BATCH_SIZE = 200;
const FETCH_CONCURRENCY = 5;

const log = createLogger("db:sync");
const assumeYes = process.argv.includes("--yes");
const databaseUrl = requireEnv("DATABASE_URL");
const sourceUrl = requireEnv("CATALOG_SOURCE_URL").replace(/\/$/u, "");
const target = new URL(databaseUrl);
const databaseName = target.pathname.replace(/^\//u, "");
const isLocal = LOCAL_HOSTS.has(target.hostname);

function print(line = ""): void {
  process.stdout.write(`${line}\n`);
}

async function fetchJson<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>> {
  const response = await fetch(`${sourceUrl}${path}`);
  if (!response.ok) {
    throw new Error(`GET ${sourceUrl}${path} failed with ${response.status}`);
  }
  return schema.parse(await response.json());
}

async function mapLimited<T, R>(items: readonly T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += FETCH_CONCURRENCY) {
    const batch = items.slice(start, start + FETCH_CONCURRENCY);
    results.push(...(await Promise.all(batch.map((item) => fn(item)))));
  }
  return results;
}

function describePlan(state: SyncState): void {
  print();
  print(`  Target database: ${target.hostname}/${databaseName}${isLocal ? "" : "  (NOT LOCAL)"}`);
  print(`  Source:          ${sourceUrl}`);
  print(
    state.markerSource === null
      ? "  This database:   empty, first sync"
      : `  This database:   last synced from ${state.markerSource} (${state.cards} cards, ${state.ruleVersions} rules versions)`,
  );
  print();
  print("  db:sync overwrites sets, cards, printings, image records, tags, keywords, rules and");
  print("  prices with the source's data. Local edits to them are lost. Rows the source no");
  print("  longer has stay. Users, decks, collections and lists are not touched.");
  if (state.markerSource !== null && state.markerSource !== sourceUrl) {
    print();
    print(`  WARNING: the last sync came from ${state.markerSource}, not ${sourceUrl}.`);
  }
  if (!isLocal) {
    print();
    print(`  WARNING: ${target.hostname} is not a local host. Check that this is a dev database.`);
  }
  print();
}

function confirm(): boolean {
  const expected = isLocal ? "yes" : databaseName;
  if (isLocal && assumeYes) {
    return true;
  }
  if (!process.stdin.isTTY) {
    throw new Error(
      isLocal
        ? "db:sync needs confirmation. Run it in a terminal or pass --yes."
        : "db:sync against a non-local database needs typed confirmation in a terminal.",
    );
  }
  const answer = prompt(`  Type "${expected}" to continue:`);
  return answer?.trim() === expected;
}

async function sync(database: Kysely<Database>): Promise<void> {
  const state = await readSyncState(database);
  if ((state.cards > 0 || state.ruleVersions > 0) && state.markerSource === null) {
    throw new Error(
      `${target.hostname}/${databaseName} already has a catalog that db:sync did not create, ` +
        "for example a restored production dump. Syncing would overwrite it, so db:sync refuses.",
    );
  }

  describePlan(state);
  if (!confirm()) {
    print("  Cancelled. Nothing was changed.");
    return;
  }

  log.info(`Fetching the catalog from ${sourceUrl}`);
  const [init, catalog] = await Promise.all([
    fetchJson("/api/v1/init", initResponseSchema),
    fetchJson("/api/v1/catalog", catalogResponseSchema),
  ]);
  const catalogRows = buildCatalogSync(init, catalog);
  await writeCatalogSync(database, catalogRows, sourceUrl);
  log.info(
    `Catalog: ${catalogRows.sets.length} sets, ${catalogRows.cards.length} cards, ${catalogRows.printings.length} printings`,
  );

  const { languages } = await fetchJson("/api/v1/rules/versions", ruleVersionsListResponseSchema);
  const versionLists = await mapLimited(languages, (language) =>
    fetchJson(
      `/api/v1/rules/versions?language=${encodeURIComponent(language)}`,
      ruleVersionsListResponseSchema,
    ),
  );
  const versions = versionLists.flatMap((list) => list.versions);
  const ruleLists = await mapLimited(versions, (version) =>
    fetchJson(
      `/api/v1/rules?${new URLSearchParams({ kind: version.kind, version: version.version, language: version.language })}`,
      rulesListResponseSchema,
    ),
  );
  const ruleRows = buildRulesSync(versions, ruleLists);
  await writeRulesSync(database, ruleRows);
  log.info(`Rules: ${ruleRows.ruleVersions.length} versions, ${ruleRows.rules.length} rules`);

  const prices = await fetchJson("/api/v1/prices", pricesResponseSchema);
  const pricedIds = Object.keys(prices.prices);
  const batches: string[][] = [];
  for (let start = 0; start < pricedIds.length; start += INFO_BATCH_SIZE) {
    batches.push(pricedIds.slice(start, start + INFO_BATCH_SIZE));
  }
  const infoResponses = await mapLimited(batches, (batch) =>
    fetchJson(
      `/api/v1/prices/marketplace-info?printings=${batch.join(",")}`,
      marketplaceInfoResponseSchema,
    ),
  );
  const infos = Object.assign({}, ...infoResponses.map((response) => response.infos));
  const priceRows = buildPricesSync(prices, infos, catalog, new Date());
  await writePricesSync(database, priceRows);
  log.info(`Prices: ${priceRows.products.length} marketplace products`);
}

const { db } = createDb(databaseUrl);
try {
  await sync(db);
} finally {
  await db.destroy();
}
