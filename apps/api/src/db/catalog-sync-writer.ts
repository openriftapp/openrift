import { marketplaceSkuKey } from "@openrift/shared/marketplace-sku-key";
import type { Kysely, Transaction } from "kysely";
import { sql } from "kysely";

import type { CatalogSync, PricesSync, RulesSync } from "./catalog-sync.js";
import { planPricesSync, SYNC_GROUP_ID } from "./catalog-sync.js";
import type { Database } from "./tables.js";

const CHUNK_SIZE = 1000;

export const SYNC_MARKER_KEY = "dev.catalog-sync-source";

type Trx = Transaction<Database>;

function chunks<T>(rows: readonly T[]): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
    result.push(rows.slice(start, start + CHUNK_SIZE));
  }
  return result;
}

async function insertChunked(trx: Trx, table: keyof Database, rows: readonly object[]) {
  for (const chunk of chunks(rows)) {
    await trx
      .insertInto(table)
      .values(chunk as any)
      .execute();
  }
}

async function upsertChunked(
  trx: Trx,
  table: keyof Database,
  rows: readonly object[],
  conflict: readonly string[],
  keep: readonly string[] = [],
) {
  for (const chunk of chunks(rows)) {
    const columns = Object.keys(chunk[0] ?? {}).filter(
      (column) => !conflict.includes(column) && !keep.includes(column),
    );
    await trx
      .insertInto(table)
      .values(chunk as any)
      .onConflict((oc) => {
        const target = oc.columns(conflict as any);
        return columns.length === 0
          ? target.doNothing()
          : target.doUpdateSet((eb) =>
              Object.fromEntries(
                columns.map((column) => [column, eb.ref(`excluded.${column}` as any)]),
              ),
            );
      })
      .execute();
  }
}

async function replaceChildren(
  trx: Trx,
  table: keyof Database,
  parentColumn: string,
  parentIds: readonly string[],
  rows: readonly object[],
) {
  for (const chunk of chunks(parentIds)) {
    await trx
      .deleteFrom(table)
      .where(parentColumn as any, "in", chunk)
      .execute();
  }
  await insertChunked(trx, table, rows);
}

function bySlug(rows: readonly { id: string; slug: string }[]): Map<string, string> {
  return new Map(rows.map((row) => [row.slug, row.id]));
}

function resolve(map: Map<string, string>, slug: string, kind: string): string {
  const id = map.get(slug);
  if (id === undefined) {
    throw new Error(`Unknown ${kind} "${slug}"`);
  }
  return id;
}

async function count(database: Kysely<Database>, table: "cards" | "ruleVersions") {
  const row = await database
    .selectFrom(table)
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

export interface SyncState {
  cards: number;
  ruleVersions: number;
  markerSource: string | null;
}

export async function readSyncState(database: Kysely<Database>): Promise<SyncState> {
  const marker = await database
    .selectFrom("siteSettings")
    .select("value")
    .where("key", "=", SYNC_MARKER_KEY)
    .executeTakeFirst();
  return {
    cards: await count(database, "cards"),
    ruleVersions: await count(database, "ruleVersions"),
    markerSource: marker?.value ?? null,
  };
}

export async function writeCatalogSync(
  database: Kysely<Database>,
  rows: CatalogSync,
  source: string,
): Promise<void> {
  await database.transaction().execute(async (trx) => {
    await trx
      .insertInto("siteSettings")
      .values({ key: SYNC_MARKER_KEY, value: source, scope: "api" })
      .onConflict((oc) => oc.column("key").doUpdateSet({ value: source }))
      .execute();

    for (const { table, rows: references } of rows.slugReferences) {
      await upsertChunked(trx, table, references, ["slug"]);
    }
    await upsertChunked(trx, "languages", rows.languages, ["code"]);
    await upsertChunked(trx, "formats", rows.formats, ["id"], ["name"]);
    await upsertChunked(trx, "keywords", rows.keywords, ["name"]);
    await upsertChunked(trx, "keywordTranslations", rows.keywordTranslations, [
      "keywordName",
      "language",
    ]);

    await upsertChunked(trx, "markers", rows.markers, ["slug"]);

    const channelIds = new Map<string, string>();
    for (const { parentSlug, ...row } of rows.distributionChannels) {
      const values = {
        ...row,
        parentId: parentSlug === null ? null : resolve(channelIds, parentSlug, "channel"),
      };
      const { id: _id, slug, ...rest } = values;
      const inserted = await trx
        .insertInto("distributionChannels")
        .values(values)
        .onConflict((oc) => oc.column("slug").doUpdateSet(rest))
        .returning(["id", "slug"])
        .executeTakeFirstOrThrow();
      channelIds.set(slug, inserted.id);
    }

    await upsertChunked(trx, "tagCategories", rows.tagCategories, ["slug"]);
    const tagCategoryIds = bySlug(
      await trx.selectFrom("tagCategories").select(["id", "slug"]).execute(),
    );
    await upsertChunked(
      trx,
      "tagDefinitions",
      rows.tagDefinitions.map(({ tag, categorySlug }) => ({
        tag,
        categoryId: resolve(tagCategoryIds, categorySlug, "tag category"),
      })),
      ["tag"],
    );

    const setIds = rows.sets.map((set) => set.id as string);
    const cardIds = rows.cards.map((card) => card.id as string);
    const faceIds = rows.faces.map((face) => face.id as string);
    const printingIds = rows.printings.map((printing) => printing.id as string);

    await upsertChunked(trx, "sets", rows.sets, ["id"]);
    await replaceChildren(trx, "setReleases", "setId", setIds, rows.setReleases);
    await upsertChunked(trx, "cards", rows.cards, ["id"]);
    await replaceChildren(trx, "cardCardTypes", "cardId", cardIds, rows.cardCardTypes);
    await replaceChildren(trx, "cardDomains", "cardId", cardIds, rows.cardDomains);
    await replaceChildren(trx, "cardSuperTypes", "cardId", cardIds, rows.cardSuperTypes);
    await replaceChildren(trx, "cardTokens", "cardId", cardIds, rows.cardTokens);
    await replaceChildren(trx, "cardErrata", "cardId", cardIds, rows.cardErrata);
    await replaceChildren(trx, "cardBans", "cardId", cardIds, rows.cardBans);
    await upsertChunked(trx, "imageFiles", rows.imageFiles, ["id"]);
    await upsertChunked(trx, "faces", rows.faces, ["id"]);
    await replaceChildren(trx, "faceImages", "faceId", faceIds, rows.faceImages);
    await upsertChunked(trx, "printings", rows.printings, ["id"]);
    await replaceChildren(
      trx,
      "printingDistributionChannels",
      "printingId",
      printingIds,
      rows.printingDistributionChannels.map(({ printingId, channelSlug, distributionNote }) => ({
        printingId,
        channelId: resolve(channelIds, channelSlug, "channel"),
        distributionNote,
      })),
    );
    await replaceChildren(
      trx,
      "printingCitations",
      "printingId",
      printingIds,
      rows.printingCitations,
    );
  });

  await sql`REFRESH MATERIALIZED VIEW mv_card_aggregates`.execute(database);
  await sql`REFRESH MATERIALIZED VIEW mv_printing_sides_canonical_rank`.execute(database);
  await sql`REFRESH MATERIALIZED VIEW mv_printing_foil_twins`.execute(database);
  await sql`SELECT bump_catalog_versions(ARRAY['response', 'content'])`.execute(database);
}

export async function writeRulesSync(database: Kysely<Database>, rows: RulesSync): Promise<void> {
  await database.transaction().execute(async (trx) => {
    await upsertChunked(trx, "ruleVersions", rows.ruleVersions, ["kind", "language", "version"]);
    for (const version of rows.ruleVersions) {
      await trx
        .deleteFrom("rules")
        .where("kind", "=", version.kind)
        .where("language", "=", version.language)
        .where("version", "=", version.version)
        .execute();
    }
    await insertChunked(trx, "rules", rows.rules);
  });
}

export async function writePricesSync(
  database: Kysely<Database>,
  rows: PricesSync,
): Promise<{ skippedProducts: number }> {
  const skippedProducts = await database.transaction().execute(async (trx) => {
    await upsertChunked(
      trx,
      "marketplaceGroups",
      rows.groups,
      ["marketplace", "groupId"],
      ["name"],
    );
    const externalIds = [...new Set(rows.products.map((product) => product.externalId))];
    const existing = await trx
      .selectFrom("marketplaceProducts")
      .select(["id", "marketplace", "externalId", "finish", "language", "groupId"])
      .where((eb) =>
        eb.or([
          eb("groupId", "=", SYNC_GROUP_ID),
          sql<boolean>`external_id = ANY(${externalIds}::int[])`,
        ]),
      )
      .execute();
    const plan = planPricesSync(rows, existing);

    for (const chunk of chunks(plan.staleProductIds)) {
      await trx
        .deleteFrom("marketplaceProductVariants")
        .where("marketplaceProductId", "in", chunk)
        .execute();
      await trx.deleteFrom("marketplaceProducts").where("id", "in", chunk).execute();
    }

    const productIds = new Map<string, string>();
    for (const chunk of chunks(plan.products)) {
      const written = await trx
        .insertInto("marketplaceProducts")
        .values(chunk.map(({ skuKey: _skuKey, ...product }) => product))
        .onConflict((oc) =>
          oc
            .columns(["marketplace", "externalId", "finish", "language"])
            .doUpdateSet((eb) => ({ productName: eb.ref("excluded.productName") }))
            .where("marketplaceProducts.groupId", "=", SYNC_GROUP_ID),
        )
        .returning(["id", "marketplace", "externalId", "finish", "language"])
        .execute();
      for (const product of written) {
        productIds.set(
          marketplaceSkuKey(
            product.marketplace,
            product.externalId,
            product.finish,
            product.language,
          ),
          product.id,
        );
      }
    }
    const productId = (skuKey: string) => resolve(productIds, skuKey, "marketplace product");

    await upsertChunked(
      trx,
      "marketplaceProductVariants",
      plan.variants.map(({ skuKey, printingId }) => ({
        marketplaceProductId: productId(skuKey),
        printingId,
      })),
      ["marketplaceProductId", "printingId"],
    );
    await replaceChildren(
      trx,
      "marketplaceProductPrices",
      "marketplaceProductId",
      [...productIds.values()],
      plan.prices.map(({ skuKey, ...price }) => ({
        ...price,
        marketplaceProductId: productId(skuKey),
      })),
    );
    return plan.skippedProducts;
  });

  // The latest view reads the daily view, so the daily one refreshes first.
  await sql`REFRESH MATERIALIZED VIEW mv_daily_printing_prices`.execute(database);
  await sql`REFRESH MATERIALIZED VIEW mv_latest_printing_prices`.execute(database);
  return { skippedProducts };
}
