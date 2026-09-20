import type { CollectionResponse, CopyResponse } from "@openrift/shared/types/api/collection";
import type { DeckCardWithDeckResponse } from "@openrift/shared/types/api/deck";
import type { Printing } from "@openrift/shared/types/catalog";
import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { createCollection, localOnlyCollectionOptions } from "@tanstack/react-db";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { stubCollection, stubCopy, stubPrinting } from "@/test/factories";

const HOME = "col-home";
const CARD = "card-x";

const printing: Printing = stubPrinting({ id: "printing-x", cardId: CARD });

function copyInBox(id: string): CopyResponse {
  return stubCopy({ id, printingId: printing.id, collectionId: HOME });
}

function cardRow(deckId: string, quantity: number, zone: DeckZone = WellKnown.deckZone.MAIN) {
  return { deckId, cardId: CARD, zone, quantity, preferredPrintingId: null };
}

function rowKey(row: DeckCardWithDeckResponse) {
  return `${row.deckId}:${row.cardId}:${row.zone}`;
}

const cardsCollection = createCollection(
  localOnlyCollectionOptions<DeckCardWithDeckResponse>({
    id: "deck-cards:deck-box-test",
    getKey: rowKey,
  }),
);

const copiesCollection = createCollection(
  localOnlyCollectionOptions<CopyResponse>({
    id: "copies:deck-box-test",
    getKey: (row) => row.id,
  }),
);

let collectionsList: CollectionResponse[] | undefined;

vi.mock("@/lib/auth-session", () => ({ useUserId: () => "user-1" }));
vi.mock("@/features/collections/hooks/use-collections", () => ({
  useCollectionsList: () => collectionsList,
}));
vi.mock("@/features/collections/hooks/use-copies-collection", () => ({
  useCopiesCollection: () => copiesCollection,
}));
vi.mock("@/features/decks/hooks/use-decks-collections", () => ({
  useDeckCardsCollection: () => cardsCollection,
}));
vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({
    printingsByCardId: new Map([[CARD, [printing]]]),
    printingsById: { [printing.id]: printing },
  }),
}));
vi.mock("@/hooks/use-effective-language-order", () => ({
  useEffectiveLanguageOrder: () => ["EN"],
}));
vi.mock("@/hooks/use-enums", () => ({ useConditionList: () => [] }));

const { useDeckBox } = await import("./use-deck-box");

function clear<T extends { id: string }>(collection: {
  toArray: T[];
  delete: (keys: string[]) => unknown;
}) {
  const existing = collection.toArray;
  if (existing.length > 0) {
    collection.delete(existing.map((row) => row.id));
  }
}

describe("useDeckBox", () => {
  beforeEach(() => {
    clear(copiesCollection);
    const rows = cardsCollection.toArray;
    if (rows.length > 0) {
      cardsCollection.delete(rows.map((row) => rowKey(row)));
    }
    copiesCollection.insert([copyInBox("copy-1"), copyInBox("copy-2"), copyInBox("copy-3")]);
    collectionsList = [
      stubCollection({
        id: HOME,
        name: "Deck Box",
        homeDecks: [
          { id: "deck-a", name: "Yasuo Aggro" },
          { id: "deck-b", name: "Yasuo Control" },
        ],
      }),
    ];
  });

  it("reserves copies for the decks sharing the box and ignores every other deck", async () => {
    cardsCollection.insert([cardRow("deck-b", 1), cardRow("deck-outsider", 3)]);

    const { result } = renderHook(() => useDeckBox("deck-a", [], HOME));

    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current?.extraCount).toBe(2);
  });

  it("skips an overflow row, which no sibling deck claims", async () => {
    cardsCollection.insert([cardRow("deck-b", 1, WellKnown.deckZone.OVERFLOW)]);

    const { result } = renderHook(() => useDeckBox("deck-a", [], HOME));

    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current?.extraCount).toBe(3);
  });

  it("plans the box when no other deck shares it", async () => {
    collectionsList = [
      stubCollection({ id: HOME, name: "Deck Box", homeDecks: [{ id: "deck-a", name: "Solo" }] }),
    ];
    cardsCollection.insert([cardRow("deck-outsider", 3)]);

    const { result } = renderHook(() => useDeckBox("deck-a", [], HOME));

    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current?.extraCount).toBe(3);
  });

  it("is undefined until the collections list arrives", () => {
    collectionsList = undefined;

    const { result } = renderHook(() => useDeckBox("deck-a", [], HOME));

    expect(result.current).toBeUndefined();
  });

  it("is undefined without a home collection", () => {
    const { result } = renderHook(() => useDeckBox("deck-a", [], null));

    expect(result.current).toBeUndefined();
  });
});
