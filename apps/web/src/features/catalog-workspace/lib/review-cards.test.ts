import type { ReviewCard } from "@openrift/shared/contracts/admin/catalog-workspace";
import { describe, expect, it } from "vitest";

import {
  pendingSummary,
  reviewCardsByKey,
  reviewSources,
  selectReviewCards,
  selectReviewQueue,
  summaryReviewKey,
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

describe("selectReviewQueue", () => {
  const data = card({ key: "data" }, { faces: 1 });
  const images = card({ key: "images" }, { newImages: 2 });
  const both = card({ key: "both" }, { cardFields: ["might"], failedImages: 1 });
  const proposalOnly = card({ key: "proposal", hasContribution: true });
  const newCard = card({ key: "new:teemo", cardSlug: null });
  const all = [data, images, both, proposalOnly, newCard];
  const keys = (cards: readonly { key: string }[]) => cards.map((entry) => entry.key);

  it("puts field, face, printing and new-printing work in the review segment", () => {
    expect(keys(selectReviewQueue(all, "review"))).toEqual([
      "data",
      "both",
      "proposal",
      "new:teemo",
    ]);
  });

  it("puts waiting and failed images in the images segment", () => {
    expect(keys(selectReviewQueue(all, "images"))).toEqual(["images", "both"]);
  });

  it("leaves no card out of both segments", () => {
    const covered = new Set([
      ...keys(selectReviewQueue(all, "review")),
      ...keys(selectReviewQueue(all, "images")),
    ]);
    expect(covered).toEqual(new Set(keys(all)));
  });

  it("walks every card when no segment is open", () => {
    expect(selectReviewQueue(all, undefined)).toEqual(all);
    expect(selectReviewQueue(all, "ready")).toEqual(all);
  });
});

describe("summaryReviewKey", () => {
  it("joins a catalog card by slug and a draft by its normalized name", () => {
    expect(summaryReviewKey({ cardSlug: "jinx", normalizedName: "jinx" })).toBe("jinx");
    expect(summaryReviewKey({ cardSlug: null, normalizedName: "teemo scout" })).toBe(
      "new:teemo scout",
    );
    const cards = [card({ key: "new:teemo scout", cardSlug: null })];
    expect(reviewCardsByKey(cards).get("new:teemo scout")).toBe(cards[0]);
  });
});
