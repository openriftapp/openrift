import type { CollectionResponse } from "@openrift/shared/types/api/collection";
import { createCollection, localOnlyCollectionOptions } from "@tanstack/react-db";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DeckFamilyEntry } from "@/features/decks/lib/deck-family";
import { stubCollection } from "@/test/factories";

const collectionsCollection = createCollection(
  localOnlyCollectionOptions<CollectionResponse>({
    id: "collections:boxed-decks-test",
    getKey: (row) => row.id,
  }),
);

let signedIn = true;

vi.mock("@/features/collections/hooks/use-collections-collection", () => ({
  useCollectionsCollection: () => (signedIn ? collectionsCollection : null),
}));

const { useBoxedDecks } = await import("./use-boxed-decks");

const FRONT = { id: "main", name: "Azir", collectionId: null };

const FAMILY: DeckFamilyEntry = {
  id: "fam",
  name: null,
  updatedAt: "2026-11-01T00:00:00.000Z",
  memberCount: 3,
  stored: [
    { deckId: "ven", deckName: "Azir VEN", collectionId: "box-green" },
    { deckId: "unl", deckName: "Azir UNL", collectionId: "box-gone" },
  ],
  expanded: false,
  role: "front",
};

describe("useBoxedDecks", () => {
  beforeEach(() => {
    signedIn = true;
    const existing = collectionsCollection.toArray;
    if (existing.length > 0) {
      collectionsCollection.delete(existing.map((row) => row.id));
    }
    collectionsCollection.insert([
      stubCollection({ id: "box-green", name: "Green box" }),
      stubCollection({ id: "box-red", name: "Red box" }),
    ]);
  });

  it("names the boxes of a collapsed family's variants and skips unknown ones", async () => {
    const { result } = renderHook(() => useBoxedDecks(FRONT, FAMILY));

    await waitFor(() =>
      expect(result.current).toEqual([
        {
          deckId: "ven",
          deckName: "Azir VEN",
          collectionId: "box-green",
          boxName: "Green box",
        },
      ]),
    );
  });

  it("names only the deck's own box", async () => {
    const { result } = renderHook(() =>
      useBoxedDecks({ ...FRONT, collectionId: "box-red" }, { ...FAMILY, expanded: true }),
    );

    await waitFor(() => expect(result.current.map((entry) => entry.boxName)).toEqual(["Red box"]));
  });

  it("is empty while nobody is signed in", () => {
    signedIn = false;

    const { result } = renderHook(() => useBoxedDecks(FRONT, FAMILY));

    expect(result.current).toEqual([]);
  });
});
