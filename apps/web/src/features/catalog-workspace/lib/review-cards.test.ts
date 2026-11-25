import type { ReviewCard } from "@openrift/shared/contracts/admin/catalog-workspace";
import { describe, expect, it } from "vitest";

import {
  pendingSummary,
  reviewCardsByKey,
  reviewNeighbor,
  reviewSources,
  reviewSteps,
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
  });
});

describe("reviewSteps", () => {
  const reviewCards = [card({ key: "vi", cardSlug: "vi" }, { faces: 1 })];

  it("walks the listing cards in the Listings segment", () => {
    const listingCards = [{ cardSlug: "jinx" }, { cardSlug: "ahri" }];
    expect(reviewSteps("listings", { reviewCards, listingCards })).toEqual([
      { key: "jinx", cardSlug: "jinx" },
      { key: "ahri", cardSlug: "ahri" },
    ]);
  });

  it("walks each ready card once in the Ready segment and skips rows with no page", () => {
    const readyRows = [
      { cardSlug: null, reviewKey: "new:teemo" },
      { cardSlug: "jinx", reviewKey: null },
      { cardSlug: "jinx", reviewKey: null },
      { cardSlug: null, reviewKey: null },
    ];
    expect(reviewSteps("ready", { reviewCards, readyRows })).toEqual([
      { key: "new:teemo", cardSlug: null },
      { key: "jinx", cardSlug: "jinx" },
    ]);
  });

  it("walks the review cards in the other segments", () => {
    expect(reviewSteps("review", { reviewCards })).toEqual(reviewCards);
    expect(reviewSteps(undefined, { reviewCards })).toEqual(reviewCards);
  });

  it("walks nothing while a segment's list has not loaded", () => {
    expect(reviewSteps("ready", { reviewCards })).toEqual([]);
    expect(reviewSteps("listings", { reviewCards })).toEqual([]);
  });
});

describe("reviewNeighbor", () => {
  const step = (key: string) => ({ key });
  const steps = [step("ahri"), step("new:jinx"), step("vi")];

  it("steps forward and back through the list", () => {
    expect(reviewNeighbor(steps, "new:jinx", 1, 1)?.key).toBe("vi");
    expect(reviewNeighbor(steps, "new:jinx", -1, 1)?.key).toBe("ahri");
  });

  it("is null past either end", () => {
    expect(reviewNeighbor(steps, "vi", 1, 2)).toBeNull();
    expect(reviewNeighbor(steps, "ahri", -1, 0)).toBeNull();
  });

  it("steps from the slot a resolved card left behind", () => {
    const rest = [step("ahri"), step("vi")];
    expect(reviewNeighbor(rest, "new:jinx", 1, 1)?.key).toBe("vi");
    expect(reviewNeighbor(rest, "new:jinx", -1, 1)?.key).toBe("ahri");
    expect(reviewNeighbor(rest, "new:jinx", 1, 2)).toBeNull();
    expect(reviewNeighbor(rest, "new:jinx", -1, 0)).toBeNull();
  });

  it("skips the card a new card turned into", () => {
    const rest = [step("ahri"), step("jinx"), step("vi")];
    expect(reviewNeighbor(rest, "new:jinx", 1, 1, "jinx")?.key).toBe("vi");
    expect(reviewNeighbor([step("jinx")], "new:jinx", 1, 0, "jinx")).toBeNull();
  });

  it("opens the first card when the position was never known", () => {
    expect(reviewNeighbor(steps, "lux", 1, -1)?.key).toBe("ahri");
    expect(reviewNeighbor(steps, "lux", -1, -1)).toBeNull();
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
