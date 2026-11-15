import type { StagedProductResponse } from "@openrift/shared/types/api/admin";
import { describe, expect, it } from "vitest";

import { scopeUnmatchedRows } from "./unmatched-scope";

function product(externalId: number, groupSetSlug?: string | null): StagedProductResponse {
  return {
    externalId,
    productName: `Product ${externalId}`,
    finish: "normal",
    language: null,
    marketCents: null,
    lowCents: null,
    zeroLowCents: null,
    currency: "USD",
    recordedAt: "2026-11-01T00:00:00.000Z",
    midCents: null,
    highCents: null,
    trendCents: null,
    avg1Cents: null,
    avg7Cents: null,
    avg30Cents: null,
    groupSetSlug,
  };
}

const unmatched = {
  tcgplayer: [product(1, "OGN"), product(2, "SFD")],
  cardmarket: [product(3, "OGN"), product(4, null)],
  cardtrader: [product(5)],
  cardnexus: [],
};

describe("scopeUnmatchedRows", () => {
  it("lists every product with its marketplace without a set", () => {
    const { rows, unattributedCount } = scopeUnmatchedRows(unmatched);

    expect(rows.map((row) => [row.marketplace, row.product.externalId]).toSorted()).toEqual([
      ["cardmarket", 3],
      ["cardmarket", 4],
      ["cardtrader", 5],
      ["tcgplayer", 1],
      ["tcgplayer", 2],
    ]);
    expect(unattributedCount).toBe(2);
  });

  it("keeps only products whose group is linked to the set", () => {
    const { rows } = scopeUnmatchedRows(unmatched, "OGN");

    expect(rows.map((row) => row.product.externalId)).toEqual([1, 3]);
  });

  it("counts products in groups without a set even when they are scoped out", () => {
    const { rows, unattributedCount } = scopeUnmatchedRows(unmatched, "SFD");

    expect(rows.map((row) => row.product.externalId)).toEqual([2]);
    expect(unattributedCount).toBe(2);
  });

  it("returns no rows for a set no group is linked to", () => {
    expect(scopeUnmatchedRows(unmatched, "VEN").rows).toEqual([]);
  });
});
