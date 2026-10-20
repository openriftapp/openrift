/* oxlint-disable import/no-nodejs-modules -- standalone CLI script reading the pair list */
/**
 * ADR-020 pair merge. Prints the plan; `--apply` runs it in one transaction.
 * `--owners <file>` writes the owners of copies that move to a default home as CSV.
 *
 * Usage: bun --env-file=.env scripts/pair-merge.ts <list.json> [--apply] [--owners <file>]
 */
import { readFileSync, writeFileSync } from "node:fs";

import { createDb } from "../apps/api/src/db/connect.js";
import { catalogRefreshRepo } from "../apps/api/src/modules/catalog/repositories/catalog-refresh.js";
import type { PairMergeList } from "../apps/api/src/modules/catalog/repositories/pair-merge.js";
import {
  applyPairMerge,
  planPairMerge,
} from "../apps/api/src/modules/catalog/repositories/pair-merge.js";
import { marketplacePricesRepo } from "../apps/api/src/modules/marketplace/repositories/marketplace-prices.js";
import { requireEnv } from "./env.js";

const args = process.argv.slice(2);
const file = args[0];
if (!file) {
  console.error(
    "Usage: bun --env-file=.env scripts/pair-merge.ts <list.json> [--apply] [--owners <file>]",
  );
  process.exit(1);
}
const apply = args.includes("--apply");
const ownersIndex = args.indexOf("--owners");
const ownersFile = ownersIndex === -1 ? undefined : args[ownersIndex + 1];

const list = JSON.parse(readFileSync(file, "utf-8")) as PairMergeList;
const { db } = createDb(requireEnv("DATABASE_URL"));

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return /[",\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

try {
  const report = apply ? await applyPairMerge(db, list) : await planPairMerge(db, list);
  if (apply) {
    await catalogRefreshRepo(db).refreshCatalogViews();
    await marketplacePricesRepo(db).refreshLatestPrices();
  }
  console.log(
    `${apply ? "Created" : "Would create"} ${report.created.length} double-sided printing(s) and ${report.newFaces.length} new side(s).`,
  );
  for (const source of report.sources) {
    const moved = Object.entries(source.moved)
      .map(([table, count]) => `${table} ${count}`)
      .join(", ");
    const home = source.defaultHome ? `${source.home} (default home)` : source.home;
    console.log(`${source.slug} -> ${home}${moved ? `: ${moved}` : ""}`);
  }
  console.log(`${report.owners.length} owner row(s) with copies on a default home.`);
  for (const item of report.productsToReview) {
    console.log(
      `Review product ${item.product}: ${item.quantity}x ${item.slug} all go to ${item.home}.`,
    );
  }
  if (ownersFile) {
    const header = "slug,home,user_id,group_id,email,copies";
    const lines = report.owners.map((owner) =>
      [owner.slug, owner.home, owner.userId, owner.groupId, owner.email, owner.copies]
        .map((value) => csvCell(value))
        .join(","),
    );
    writeFileSync(ownersFile, `${[header, ...lines].join("\n")}\n`);
    console.log(`Owners written to ${ownersFile}.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
