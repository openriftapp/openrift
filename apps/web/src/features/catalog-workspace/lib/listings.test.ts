import type { WorkspaceQueueItem } from "@openrift/shared/contracts/admin/catalog-workspace";
import { describe, expect, it } from "vitest";

import type { ListingCard } from "./listings";
import { listingCardSummary, listingsOverview, selectListingCards } from "./listings";

function item(overrides: Partial<WorkspaceQueueItem>): WorkspaceQueueItem {
  return {
    id: "printing:listing:p1:tcg",
    owner: "printing",
    segment: "open",
    ownerId: "p1",
    cardSlug: "jinx-loose-cannon",
    cardName: "Jinx, Loose Cannon",
    label: "OGN-030",
    reason: "listing",
    provider: "Marketplace A",
    isContributor: false,
    decisions: 1,
    fields: ["listing"],
    createdAt: "2026-11-20T10:00:00.000Z",
    ...overrides,
  };
}

function card(overrides: Partial<ListingCard>): ListingCard {
  return {
    cardSlug: "jinx-loose-cannon",
    cardName: "Jinx, Loose Cannon",
    suggestedPrintings: 0,
    withoutPrinting: 0,
    variants: [],
    waitingSince: "2026-11-20T10:00:00.000Z",
    ...overrides,
  };
}

describe("listingsOverview", () => {
  it("merges suggested printings and listings without a printing into one row per card", () => {
    const overview = listingsOverview([
      item({ id: "a", ownerId: "p1", createdAt: "2026-11-21T10:00:00.000Z" }),
      item({ id: "b", ownerId: "p1", createdAt: "2026-11-22T10:00:00.000Z" }),
      item({ id: "c", ownerId: "p2", createdAt: "2026-11-23T10:00:00.000Z" }),
      item({
        id: "d",
        segment: "new",
        ownerId: "listing-card:jinx-loose-cannon",
        variants: [
          { language: "EN", finish: "foil", count: 2 },
          { language: null, finish: "normal", count: 1 },
        ],
        createdAt: "2026-11-19T10:00:00.000Z",
      }),
    ]);

    expect(overview.cards).toEqual([
      {
        cardSlug: "jinx-loose-cannon",
        cardName: "Jinx, Loose Cannon",
        suggestedPrintings: 2,
        withoutPrinting: 3,
        variants: [
          { language: "EN", finish: "foil", count: 2 },
          { language: null, finish: "normal", count: 1 },
        ],
        waitingSince: "2026-11-19T10:00:00.000Z",
      },
    ]);
    expect(overview.noCardCount).toBe(0);
  });

  it("orders cards by the longest wait, then by name", () => {
    const overview = listingsOverview([
      item({
        id: "a",
        cardSlug: "yasuo",
        cardName: "Yasuo",
        createdAt: "2026-11-22T10:00:00.000Z",
      }),
      item({ id: "b", cardSlug: "ahri", cardName: "Ahri", createdAt: "2026-11-22T10:00:00.000Z" }),
      item({ id: "c", cardSlug: "jinx", cardName: "Jinx", createdAt: "2026-11-21T10:00:00.000Z" }),
    ]);

    expect(overview.cards.map((entry) => entry.cardSlug)).toEqual(["jinx", "ahri", "yasuo"]);
  });

  it("counts listings that match no card apart from the card rows", () => {
    const overview = listingsOverview([
      item({ id: "a", segment: "new", cardSlug: null, ownerId: "listing:1" }),
      item({ id: "b", segment: "new", cardSlug: null, ownerId: "listing:2" }),
    ]);

    expect(overview.cards).toEqual([]);
    expect(overview.noCardCount).toBe(2);
  });

  it("leaves out queue items that are not listings", () => {
    const overview = listingsOverview([
      item({ id: "a", reason: "source-difference" }),
      item({ id: "b", reason: "new-printing", cardSlug: null }),
    ]);

    expect(overview).toEqual({ cards: [], noCardCount: 0 });
  });

  it("returns an empty overview for an empty queue", () => {
    expect(listingsOverview([])).toEqual({ cards: [], noCardCount: 0 });
  });
});

describe("listingCardSummary", () => {
  it("names both kinds of work", () => {
    expect(listingCardSummary(card({ suggestedPrintings: 3, withoutPrinting: 2 }))).toBe(
      "3 printings with a suggestion · 2 listings without a printing",
    );
  });

  it("uses the singular and drops a kind with nothing to do", () => {
    expect(listingCardSummary(card({ suggestedPrintings: 1 }))).toBe(
      "1 printing with a suggestion",
    );
    expect(listingCardSummary(card({ withoutPrinting: 1 }))).toBe("1 listing without a printing");
  });
});

describe("selectListingCards", () => {
  const cards = [
    card({ cardSlug: "jinx", cardName: "Jinx, Loose Cannon" }),
    card({ cardSlug: "ahri", cardName: "Ahri, Nine-Tailed Fox" }),
  ];

  it("keeps every card for a blank query", () => {
    expect(selectListingCards(cards, "  ")).toEqual(cards);
  });

  it("filters by card name", () => {
    expect(selectListingCards(cards, "nine tailed").map((entry) => entry.cardSlug)).toEqual([
      "ahri",
    ]);
  });

  it("returns nothing when no name matches", () => {
    expect(selectListingCards(cards, "Yasuo")).toEqual([]);
  });
});
