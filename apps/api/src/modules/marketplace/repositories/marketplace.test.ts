import { readFileSync } from "node:fs";

import { headlinePrice } from "@openrift/shared/price-headline";
import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";
import { beforeEach, describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { createRecordingDb, onlyStatement } from "../../../test/recording-db.js";
import { marketplaceRepo } from "./marketplace.js";

const SCHEMA_PATH = new URL("../../../../../../docs/schema.sql", import.meta.url);

const COLUMN_ROLE: Record<string, string> = {
  zero_carried: "zero",
  zero_low_cents: "zero",
  low_cents: "low",
  market_cents: "market",
};

function squash(text: string): string {
  return text.replaceAll(/\s+/gu, " ").trim();
}

/** Marketplace (or "else") to the COALESCE order of the first headline CASE in `sql`. */
function headlineRule(sql: string): Map<string, string[]> {
  const caseBody = /CASE (?<body>.*?) END/u.exec(sql)?.groups?.body ?? "";
  const rule = new Map<string, string[]>();
  const branch =
    /(?:WHEN \(?\w+\.marketplace = '(?<marketplace>\w+)'(?:::text)?\)? THEN|ELSE) COALESCE\((?<args>[^)]*)\)/gu;
  for (const { groups } of caseBody.matchAll(branch)) {
    const marketplace = groups?.marketplace;
    const roles = (groups?.args ?? "")
      .split(",")
      .map((arg) => COLUMN_ROLE[arg.trim().split(".").at(-1) ?? ""] ?? arg);
    rule.set(marketplace ?? "else", roles);
  }
  return rule;
}

describe("marketplaceRepo", () => {
  it("sourcesForPrintings short-circuits on empty input", async () => {
    const db = createMockDb([{ printingId: "p1", externalId: 12_345, marketplace: "tcgplayer" }]);
    const repo = marketplaceRepo(db);
    expect(await repo.sourcesForPrintings([])).toEqual([]);
  });
});

describe("marketplaceRepo (generated SQL)", () => {
  const captured = createRecordingDb();

  beforeEach(() => {
    captured.reset();
  });

  it("sourcesForPrintings binds every printing id it was given", async () => {
    await marketplaceRepo(captured.db).sourcesForPrintings(["pr-1", "pr-2"]);

    expect(onlyStatement(captured).parameters).toEqual(["pr-1", "pr-2"]);
  });

  it("sourcesForAllPrintings binds no printing filter", async () => {
    await marketplaceRepo(captured.db).sourcesForAllPrintings();

    expect(onlyStatement(captured).parameters).toEqual([]);
  });

  it("sourcesForPrintings computes each product's headline the way mv_daily_printing_prices does", async () => {
    await marketplaceRepo(captured.db).sourcesForPrintings(["pr-1"]);
    const ours = squash(onlyStatement(captured).sql);

    const schema = readFileSync(SCHEMA_PATH, "utf-8");
    const start = schema.indexOf("CREATE MATERIALIZED VIEW public.mv_daily_printing_prices");
    const view = squash(schema.slice(start, schema.indexOf("WITH NO DATA", start)));

    expect(headlineRule(ours)).toEqual(headlineRule(view));
    expect(headlineRule(ours).size).toBe(3);
    expect(view).toContain("(pp.zero_low_cents IS NULL), pp.recorded_at DESC");
    expect(ours).toContain("ORDER BY (pp.zero_low_cents IS NULL), pp.recorded_at DESC");
  });

  it("applies the same headline order in the shared headlinePrice", () => {
    const schema = readFileSync(SCHEMA_PATH, "utf-8");
    const start = schema.indexOf("CREATE MATERIALIZED VIEW public.mv_daily_printing_prices");
    const rule = headlineRule(squash(schema.slice(start, schema.indexOf("WITH NO DATA", start))));
    const value: Record<string, number> = { market: 1, low: 2, zero: 3 };
    const columns = (roles: readonly string[]) => ({
      market: roles.includes("market") ? value.market : null,
      low: roles.includes("low") ? value.low : null,
      zeroLow: roles.includes("zero") ? value.zero : null,
    });

    for (const marketplace of ALL_MARKETPLACES) {
      const [first = "", second = ""] = rule.get(marketplace) ?? rule.get("else") ?? [];
      expect(headlinePrice(marketplace, columns([first, second]))).toBe(value[first]);
      expect(headlinePrice(marketplace, columns([second]))).toBe(value[second]);
    }
  });
});
