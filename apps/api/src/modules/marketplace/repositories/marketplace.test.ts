import { readFileSync } from "node:fs";

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
  it("latestPrices returns price rows", async () => {
    const rows = [{ printingId: "p1", marketplace: "tcgplayer", marketCents: 1500 }];
    const db = createMockDb(rows);
    const repo = marketplaceRepo(db);
    expect(await repo.latestPrices()).toEqual(rows);
  });

  it("sourcesForPrintings short-circuits on empty input", async () => {
    const db = createMockDb([]);
    const repo = marketplaceRepo(db);
    expect(await repo.sourcesForPrintings([])).toEqual([]);
  });

  it("sourcesForPrintings returns batched product sources", async () => {
    const rows = [
      { printingId: "p1", externalId: 12_345, marketplace: "tcgplayer" },
      { printingId: "p2", externalId: 67_890, marketplace: "cardmarket" },
    ];
    const db = createMockDb(rows);
    const repo = marketplaceRepo(db);
    expect(await repo.sourcesForPrintings(["p1", "p2"])).toEqual(rows);
  });

  it("snapshots without cutoff returns all snapshots", async () => {
    const rows = [{ recordedAt: new Date(), marketCents: 1500 }];
    const db = createMockDb(rows);
    const repo = marketplaceRepo(db);
    expect(await repo.snapshots("ps1", null)).toEqual(rows);
  });

  it("snapshots with cutoff filters by date", async () => {
    const db = createMockDb([]);
    const repo = marketplaceRepo(db);
    expect(await repo.snapshots("ps1", new Date("2025-01-01"))).toEqual([]);
  });
});

describe("marketplaceRepo (generated SQL)", () => {
  const captured = createRecordingDb();

  beforeEach(() => {
    captured.reset();
  });

  it("sourcesForPrintings picks the product matching the latest headline, then the lowest external id", async () => {
    await marketplaceRepo(captured.db).sourcesForPrintings(["pr-1"]);

    const sql = squash(onlyStatement(captured).sql);
    expect(sql).toMatch(/^SELECT DISTINCT ON \(mpv\.printing_id, mp\.marketplace\) /u);
    expect(sql).toContain('mpv.id AS "variantId"');
    expect(sql).toContain(
      "LEFT JOIN mv_latest_printing_prices lp ON lp.printing_id = mpv.printing_id AND lp.marketplace = mp.marketplace",
    );
    expect(sql).toContain("pp.recorded_at >= lp.last_seen AND pp.recorded_at < lp.last_seen + 1");
    expect(sql).toMatch(
      /ORDER BY mpv\.printing_id, mp\.marketplace, \(own\.headline_cents = lp\.headline_cents\) IS TRUE DESC, mp\.external_id, mpv\.id$/u,
    );
  });

  it("sourcesForPrintings binds every printing id it was given", async () => {
    await marketplaceRepo(captured.db).sourcesForPrintings(["pr-1", "pr-2"]);

    const { sql, parameters } = onlyStatement(captured);
    expect(squash(sql)).toContain("WHERE mpv.printing_id IN ($1, $2)");
    expect(parameters).toEqual(["pr-1", "pr-2"]);
  });

  it("sourcesForAllPrintings has no printing filter", async () => {
    await marketplaceRepo(captured.db).sourcesForAllPrintings();

    const { sql, parameters } = onlyStatement(captured);
    expect(squash(sql)).not.toContain("WHERE mpv.printing_id");
    expect(parameters).toEqual([]);
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
});
