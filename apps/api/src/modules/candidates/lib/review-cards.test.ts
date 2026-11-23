import type { WorkspaceQueueItem } from "@openrift/shared/contracts/admin/catalog-workspace";
import { describe, expect, it } from "vitest";

import { toReviewCards } from "./review-cards.js";

function item(overrides: Partial<WorkspaceQueueItem>): WorkspaceQueueItem {
  return {
    id: crypto.randomUUID(),
    owner: "card",
    segment: "open",
    ownerId: "vi-destructive",
    cardSlug: "vi-destructive",
    cardName: "Vi, Destructive",
    label: "Vi, Destructive",
    reason: "source-difference",
    provider: "provider-a",
    isContributor: false,
    decisions: 1,
    fields: [],
    createdAt: "2026-11-20T09:00:00.000Z",
    ...overrides,
  };
}

describe("toReviewCards", () => {
  it("folds a card's card, face and printing items into one row", () => {
    const cards = toReviewCards([
      item({ fields: ["might"] }),
      item({ owner: "face", ownerId: "face-1", fields: ["rarity", "artist"] }),
      item({ owner: "face", ownerId: "face-1", provider: "provider-b", fields: ["rarity"] }),
      item({ owner: "printing", ownerId: "printing-1", fields: ["size"] }),
      item({ owner: "face", ownerId: "face-1", reason: "new-image" }),
      item({ owner: "face", ownerId: "face-2", reason: "image-rehost-failed", provider: null }),
    ]);

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      key: "vi-destructive",
      cardSlug: "vi-destructive",
      providers: ["provider-a", "provider-b"],
      pending: {
        cardFields: ["might"],
        newPrintings: 0,
        faces: 1,
        printings: 1,
        newImages: 1,
        failedImages: 1,
      },
    });
  });

  it("counts a new printing reported by two sources once", () => {
    const fresh = { owner: "printing", segment: "new", reason: "new-printing" } as const;
    const [card] = toReviewCards([
      item({ ...fresh, ownerId: "cp-1", label: "OGN-045a foil EN" }),
      item({ ...fresh, ownerId: "cp-2", label: "OGN-045a foil EN", provider: "provider-b" }),
      item({ ...fresh, ownerId: "cp-3", label: "OGN-045 foil EN" }),
    ]);

    expect(card?.pending.newPrintings).toBe(2);
  });

  it("keys a new card by its normalized name", () => {
    const [card] = toReviewCards([
      item({
        segment: "new",
        reason: "new-card",
        ownerId: "teemoswiftscout",
        cardSlug: null,
        cardName: "Teemo, Swift Scout",
      }),
    ]);

    expect(card).toMatchObject({ key: "new:teemoswiftscout", cardSlug: null });
  });

  it("leaves listings out", () => {
    const cards = toReviewCards([
      item({ owner: "printing", reason: "listing", fields: ["listing"] }),
      item({ owner: "printing", segment: "new", reason: "listing", cardSlug: null }),
    ]);

    expect(cards).toEqual([]);
  });

  it("marks a contribution but not a desk upload", () => {
    const cards = toReviewCards([
      item({ reason: "contributor-proposal", isContributor: true, provider: "usersubmission" }),
      item({
        owner: "face",
        ownerId: "face-9",
        cardSlug: "ahri-alluring",
        cardName: "Ahri, Alluring",
        reason: "new-image",
        provider: null,
        isContributor: true,
      }),
    ]);

    expect(cards.map((card) => [card.key, card.hasContribution])).toEqual([
      ["vi-destructive", true],
      ["ahri-alluring", false],
    ]);
  });

  it("orders contributions first, then the longest wait", () => {
    const cards = toReviewCards([
      item({ cardSlug: "b", cardName: "B", createdAt: "2026-11-18T09:00:00.000Z" }),
      item({ cardSlug: "a", cardName: "A", createdAt: "2026-11-19T09:00:00.000Z" }),
      item({ cardSlug: "a", cardName: "A", createdAt: "2026-11-17T09:00:00.000Z" }),
      item({
        cardSlug: "c",
        cardName: "C",
        reason: "contributor-proposal",
        isContributor: true,
        provider: "usersubmission",
        createdAt: "2026-11-21T09:00:00.000Z",
      }),
    ]);

    expect(cards.map((card) => card.key)).toEqual(["c", "a", "b"]);
    expect(cards[1]?.waitingSince).toBe("2026-11-17T09:00:00.000Z");
  });
});
