/* oxlint-disable import/no-nodejs-modules -- standalone CLI script reading the pair list */
/**
 * ADR-020 pair merge. Prints the plan; `--apply` runs it in one transaction.
 *
 * Usage: bun --env-file=.env scripts/pair-merge.ts <list.json> [--apply]
 */
import { readFileSync } from "node:fs";

import { createDb } from "../apps/api/src/db/connect.js";
import { catalogRefreshRepo } from "../apps/api/src/modules/catalog/repositories/catalog-refresh.js";
import type { PairMergeList } from "../apps/api/src/modules/catalog/repositories/pair-merge.js";
import {
  applyPairMerge,
  planPairMerge,
} from "../apps/api/src/modules/catalog/repositories/pair-merge.js";
import { requireEnv } from "./env.js";

const [file, flag] = process.argv.slice(2);
if (!file) {
  console.error("Usage: bun --env-file=.env scripts/pair-merge.ts <list.json> [--apply]");
  process.exit(1);
}

const list = JSON.parse(readFileSync(file, "utf-8")) as PairMergeList;
const { db } = createDb(requireEnv("DATABASE_URL"));

try {
  const apply = flag === "--apply";
  const report = apply ? await applyPairMerge(db, list) : await planPairMerge(db, list);
  if (apply) {
    await catalogRefreshRepo(db).refreshCatalogViews();
  }
  console.log(
    `${apply ? "Created" : "Would create"} ${report.created.length} double-sided printing(s).`,
  );
  for (const source of report.sources) {
    const moved = Object.entries(source.moved)
      .map(([table, count]) => `${table} ${count}`)
      .join(", ");
    console.log(`${source.slug} -> ${source.home}${moved ? `: ${moved}` : ""}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
