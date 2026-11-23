import type { ReviewCard } from "@openrift/shared/contracts/admin/catalog-workspace";
import { describe, expect, it } from "vitest";

import {
  pendingSummary,
  reviewSources,
  selectReviewCards,
} from "@/features/catalog-workspace/lib/review-cards";

function card(overrides: Partial<ReviewCard> = {}, pending: Partial<ReviewCard["pending"]> = {}) {
  return {
    key: "vi-destructive",
    cardSlug: "vi-destructive",
    cardName: "Vi, Destructive",
    hasContribution: false,
    providers: ["provider-a"],
    waitingSince: "2026-11-20T09:00:00.000Z",
    ...overrides,
    pending: {
      cardFields: [],
      newPrintings: 0,
      faces: 0,
      printings: 0,
      newImages: 0,
      failedImages: 0,
      ...pending,
    },
  } satisfies ReviewCard;
}

describe("pendingSummary", () => {
  it("names the differing card fields by their labels", () => {
    expect(pendingSummary(card({}, { cardFields: ["might"] }))).toBe("Might differs");
    expect(pendingSummary(card({}, { cardFields: ["might", "energy"] }))).toBe(
      "Might, Energy differ",
    );
  });

  it("joins every kind of pending work with singular and plural nouns", () => {
    expect(
      pendingSummary(
        card({}, { newPrintings: 2, faces: 1, printings: 3, newImages: 1, failedImages: 1 }),
      ),
    ).toBe(
      "2 new printings · 1 face differs · 3 printings differ · 1 new image · 1 image failed to rehost",
    );
  });

  it("leads with New card for a card that is not in the catalog", () => {
    expect(pendingSummary(card({ cardSlug: null, key: "new:teemo" }, { newPrintings: 1 }))).toBe(
      "New card · 1 new printing",
    );
  });
});

describe("reviewSources", () => {
  it("names the contributor source in plain words", () => {
    expect(reviewSources(card({ providers: ["provider-a", "usersubmission"] }))).toBe(
      "provider-a, Contributor",
    );
  });
});

describe("selectReviewCards", () => {
  const cards = [card(), card({ key: "b", cardName: "Ahri, Alluring", providers: ["provider-b"] })];

  it("returns every card for an empty query", () => {
    expect(selectReviewCards(cards, "  ")).toHaveLength(2);
  });

  it("matches the card name or a source, ignoring case", () => {
    expect(selectReviewCards(cards, "ahri").map((entry) => entry.key)).toEqual(["b"]);
    expect(selectReviewCards(cards, "PROVIDER-A").map((entry) => entry.key)).toEqual([
      "vi-destructive",
    ]);
  });

  it("returns nothing when no card matches", () => {
    expect(selectReviewCards(cards, "teemo")).toEqual([]);
  });
});
