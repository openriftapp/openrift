import type { ReviewCard } from "@openrift/shared/contracts/admin/catalog-workspace";
import { describe, expect, it } from "vitest";

import { buildReadyRows, readyBatchKeys, selectReadyRows } from "./ready-rows";

function reviewCard(overrides: Partial<ReviewCard>): ReviewCard {
  return {
    key: "jinx-rebel",
    cardSlug: "jinx-rebel",
    cardName: "Jinx, Rebel",
    hasContribution: false,
    providers: ["provider-a"],
    pending: {
      cardFields: [],
      newPrintings: 1,
      faces: 0,
      printings: 0,
      newImages: 0,
      failedImages: 0,
    },
    waitingSince: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const REVIEW = [
  reviewCard({}),
  reviewCard({ key: "new:poro", cardSlug: null, cardName: "Poro", providers: ["provider-b"] }),
];

const rows = buildReadyRows(
  REVIEW,
  { count: 1, names: ["Poro"], ineligible: [{ name: "Gold", reason: "no card type" }] },
  {
    count: 1,
    items: [
      {
        candidatePrintingId: "cp1",
        cardSlug: "jinx-rebel",
        label: "OGN-030a foil EN",
        providers: ["provider-a"],
      },
    ],
    ineligible: [
      {
        candidatePrintingId: "cp2",
        cardSlug: "ahri-alluring",
        label: "OGN-066 foil FR",
        providers: ["provider-a", "provider-b"],
        reason: "missing: rarity",
      },
    ],
  },
);

describe("buildReadyRows", () => {
  it("names the card, what would be created and its sources", () => {
    expect(rows.map((row) => [row.cardName, row.creates, row.sources, row.refusal])).toEqual([
      ["Poro", "New card", "provider-b", null],
      ["Jinx, Rebel", "OGN-030a foil EN", "provider-a", null],
      ["Gold", "New card", "", "no card type"],
      ["ahri-alluring", "OGN-066 foil FR", "provider-a, provider-b", "missing: rarity"],
    ]);
  });

  it("links a new card through its review key and a printing through its card", () => {
    expect(rows.map((row) => [row.reviewKey, row.cardSlug])).toEqual([
      ["new:poro", null],
      [null, "jinx-rebel"],
      [null, null],
      [null, "ahri-alluring"],
    ]);
  });
});

describe("readyBatchKeys", () => {
  it("leaves refused rows out", () => {
    expect(readyBatchKeys(rows)).toEqual({ cards: ["Poro"], printings: ["cp1"] });
  });

  it("covers only the rows a search leaves on screen", () => {
    expect(readyBatchKeys(selectReadyRows(rows, "jinx"))).toEqual({
      cards: [],
      printings: ["cp1"],
    });
  });
});
