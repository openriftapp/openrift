import { describe, expect, it } from "vitest";

import {
  buildPriceAssignBucketsBySlug,
  computePriceAssignBuckets,
} from "./price-assign-buckets.js";
import type { StagedProductResponse, UnifiedMappingGroupResponse } from "./types/api/admin.js";

function stagedProduct(overrides: Partial<StagedProductResponse> = {}): StagedProductResponse {
  return {
    externalId: 999,
    productName: "Mystery",
    finish: "normal",
    language: "EN",
    marketCents: null,
    lowCents: null,
    currency: "USD",
    recordedAt: "2026-01-01T00:00:00Z",
    midCents: null,
    highCents: null,
    trendCents: null,
    avg1Cents: null,
    avg7Cents: null,
    avg30Cents: null,
    ...overrides,
  };
}

function group(
  printingLanguages: string[],
  staged: {
    tcg?: StagedProductResponse[];
    cm?: StagedProductResponse[];
    ct?: StagedProductResponse[];
    cn?: StagedProductResponse[];
  },
  cardSlug = "fireball",
): UnifiedMappingGroupResponse {
  const marketplace = (stagedProducts: StagedProductResponse[] = []) => ({
    stagedProducts,
    assignedProducts: [],
    assignments: [],
  });
  return {
    cardSlug,
    printings: printingLanguages.map((language) => ({ language })),
    tcgplayer: marketplace(staged.tcg),
    cardmarket: marketplace(staged.cm),
    cardtrader: marketplace(staged.ct),
    cardnexus: marketplace(staged.cn),
  } as unknown as UnifiedMappingGroupResponse;
}

describe("computePriceAssignBuckets", () => {
  it("returns no buckets when there are no staged entries", () => {
    expect(computePriceAssignBuckets(group(["EN"], {}))).toEqual([]);
  });

  it("buckets a Cardmarket staged entry as language-agnostic and assignable against EN", () => {
    expect(computePriceAssignBuckets(group(["EN"], { cm: [stagedProduct()] }))).toEqual([
      { marketplace: "cardmarket", language: null, unbound: 1, assignable: true },
    ]);
  });

  it("CM/TCG buckets are un-assignable when the card has no EN printing", () => {
    expect(computePriceAssignBuckets(group(["SC"], { tcg: [stagedProduct()] }))).toEqual([
      { marketplace: "tcgplayer", language: null, unbound: 1, assignable: false },
    ]);
  });

  it("splits CardTrader entries per language and marks FR un-assignable without a FR printing", () => {
    const buckets = computePriceAssignBuckets(
      group(["EN"], {
        ct: [
          stagedProduct({ language: "EN" }),
          stagedProduct({ language: "FR" }),
          stagedProduct({ language: "FR" }),
        ],
      }),
    );
    expect(buckets).toContainEqual({
      marketplace: "cardtrader",
      language: "EN",
      unbound: 1,
      assignable: true,
    });
    expect(buckets).toContainEqual({
      marketplace: "cardtrader",
      language: "FR",
      unbound: 2,
      assignable: false,
    });
  });

  it("marks a CardTrader FR bucket assignable once a FR printing exists", () => {
    expect(
      computePriceAssignBuckets(group(["FR"], { ct: [stagedProduct({ language: "FR" })] })),
    ).toEqual([{ marketplace: "cardtrader", language: "FR", unbound: 1, assignable: true }]);
  });

  it("splits CardNexus entries per language", () => {
    expect(
      computePriceAssignBuckets(group(["EN"], { cn: [stagedProduct({ language: "SC" })] })),
    ).toEqual([{ marketplace: "cardnexus", language: "SC", unbound: 1, assignable: false }]);
  });
});

describe("buildPriceAssignBucketsBySlug", () => {
  it("indexes buckets by card slug and leaves out cards without staged entries", () => {
    const bySlug = buildPriceAssignBucketsBySlug([
      group(["EN"], { cm: [stagedProduct()] }, "fireball"),
      group(["EN"], {}, "blizzard"),
    ]);
    expect(Object.keys(bySlug)).toEqual(["fireball"]);
    expect(bySlug.fireball).toHaveLength(1);
  });
});
