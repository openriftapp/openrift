import { describe, expect, it, vi } from "vitest";

import type { ProfileListRepos } from "./user-profile-lists.js";
import { PREVIEW_IMAGE_COUNT, expandOwnerLists, overlapWithViewer } from "./user-profile-lists.js";

const cardRow = (cardId: string) => ({ kind: "card", cardId }) as never;
const printingRow = (printingId: string, imageId: string | null) =>
  ({ kind: "printing", printingId, imageId }) as never;
const copyRow = (printingId: string, imageId: string | null) =>
  ({ kind: "copy", printingId, imageId }) as never;

const PRINTING_CARD: Record<string, string> = {
  "pr-1": "card-1",
  "pr-2": "card-2",
  "pr-3": "card-3",
};

function repos(overrides: Partial<ProfileListRepos["lists"]> = {}): ProfileListRepos {
  return {
    lists: {
      entriesWithDetailsAnon: vi.fn().mockResolvedValue([]),
      entriesWithDetails: vi.fn().mockResolvedValue([]),
      listForUser: vi.fn().mockResolvedValue([]),
      ...overrides,
    },
    userProfile: {
      cardIdsForPrintings: vi.fn((ids: readonly string[]) =>
        Promise.resolve(new Map(ids.map((id) => [id, PRINTING_CARD[id] ?? "card-x"]))),
      ),
    },
    canonicalPrintings: {
      resolvePrintingMetaForRows: vi.fn((rows: { cardId: string }[]) =>
        Promise.resolve(
          rows.map(({ cardId }) => ({
            cardId,
            imageId: cardId === "card-noimg" ? null : `img-${cardId}`,
          })),
        ),
      ),
    },
  };
}

describe("expandOwnerLists", () => {
  it("collects distinct card ids across card, printing and copy entries", async () => {
    const r = repos({
      entriesWithDetailsAnon: vi
        .fn()
        .mockResolvedValue([
          cardRow("card-1"),
          printingRow("pr-1", "img-a"),
          copyRow("pr-2", null),
        ]),
    });
    const expanded = await expandOwnerLists(r, [{ id: "l-1", kind: "copy" }]);
    const list = expanded.get("l-1")!;

    expect(list.entryCount).toBe(3);
    expect([...list.cardIds].toSorted()).toEqual(["card-1", "card-2"]);
  });

  it("builds the preview row from entry order, skipping entries without art", async () => {
    const r = repos({
      entriesWithDetailsAnon: vi
        .fn()
        .mockResolvedValue([
          printingRow("pr-1", null),
          cardRow("card-noimg"),
          cardRow("card-2"),
          printingRow("pr-2", "img-b"),
          printingRow("pr-3", "img-b"),
          cardRow("card-3"),
          cardRow("card-4"),
          cardRow("card-5"),
        ]),
    });
    const expanded = await expandOwnerLists(r, [{ id: "l-1", kind: "card" }]);

    expect(expanded.get("l-1")!.previewImageIds).toEqual([
      "img-card-2",
      "img-b",
      "img-card-3",
      "img-card-4",
    ]);
    expect(expanded.get("l-1")!.previewImageIds).toHaveLength(PREVIEW_IMAGE_COUNT);
  });

  it("does not resolve card art when the list has no card-kind entries", async () => {
    const r = repos({
      entriesWithDetailsAnon: vi.fn().mockResolvedValue([printingRow("pr-1", "img-a")]),
    });
    await expandOwnerLists(r, [{ id: "l-1", kind: "printing" }]);
    expect(r.canonicalPrintings.resolvePrintingMetaForRows).not.toHaveBeenCalled();
  });
});

describe("overlapWithViewer", () => {
  it("intersects the owner's wants with the viewer's trades and the reverse", async () => {
    const r = repos({
      listForUser: vi.fn((_: string, intent?: string) =>
        Promise.resolve(
          intent === "wish"
            ? [{ id: "v-wish", kind: "card" as const, intent: "wish" as const }]
            : [{ id: "v-trade", kind: "printing" as const, intent: "trade" as const }],
        ),
      ),
      entriesWithDetails: vi.fn((listId: string) =>
        Promise.resolve(
          listId === "v-wish"
            ? [cardRow("card-2"), cardRow("card-9")]
            : [printingRow("pr-1", null), printingRow("pr-3", null)],
        ),
      ),
    });
    const ownerLists = [
      { id: "o-wish", kind: "card" as const, intent: "wish" as const },
      { id: "o-trade", kind: "copy" as const, intent: "trade" as const },
    ];
    const expanded = new Map([
      [
        "o-wish",
        {
          listId: "o-wish",
          entryCount: 3,
          cardIds: new Set(["card-1", "card-3", "card-7"]),
          previewImageIds: [],
        },
      ],
      [
        "o-trade",
        {
          listId: "o-trade",
          entryCount: 2,
          cardIds: new Set(["card-2", "card-5"]),
          previewImageIds: [],
        },
      ],
    ]);

    const overlap = await overlapWithViewer(r, "viewer", ownerLists, expanded);

    expect(overlap.theyWantYouHave).toBe(2);
    expect(overlap.theyOfferYouWant).toBe(1);
    expect(overlap.perList.get("o-wish")).toBe(2);
    expect(overlap.perList.get("o-trade")).toBe(1);
  });

  it("counts a card once even when it sits on several of the owner's lists", async () => {
    const r = repos({
      listForUser: vi.fn((_: string, intent?: string) =>
        Promise.resolve(
          intent === "trade"
            ? [{ id: "v-trade", kind: "card" as const, intent: "trade" as const }]
            : [],
        ),
      ),
      entriesWithDetails: vi.fn().mockResolvedValue([cardRow("card-1")]),
    });
    const ownerLists = [
      { id: "o-1", kind: "card" as const, intent: "wish" as const },
      { id: "o-2", kind: "card" as const, intent: "wish" as const },
    ];
    const expanded = new Map(
      ownerLists.map((list) => [
        list.id,
        { listId: list.id, entryCount: 1, cardIds: new Set(["card-1"]), previewImageIds: [] },
      ]),
    );

    const overlap = await overlapWithViewer(r, "viewer", ownerLists, expanded);

    expect(overlap.theyWantYouHave).toBe(1);
    expect(overlap.perList.get("o-1")).toBe(1);
    expect(overlap.perList.get("o-2")).toBe(1);
  });
});
