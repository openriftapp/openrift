import type {
  DeckCardWithDeckResponse,
  DeckListItemResponse,
} from "@openrift/shared/types/api/deck";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDeckCardsCollection } from "./decks-collection";
import { decksKeys } from "./decks-query-keys";

interface DeckCardsPage {
  items: DeckCardWithDeckResponse[];
  touchedDeckIds?: string[];
  nextCursor?: string | null;
  syncedXid?: string;
}

interface SentRead {
  since: string | null;
  cursor: string | null;
}

const userId = "user-1";
const cursor = "1000_00000000-0000-0000-0000-000000000001";

let queryClient: QueryClient;
let reads: SentRead[];
let pages: DeckCardsPage[];

function card(deckId: string, cardId: string, quantity = 1): DeckCardWithDeckResponse {
  return { deckId, cardId, zone: "main", quantity, preferredPrintingId: null };
}

function serve(...next: DeckCardsPage[]): void {
  pages = next;
}

function decksOnServer(...deckIds: string[]): void {
  queryClient.setQueryData(
    decksKeys.syncedStore(userId),
    deckIds.map((id) => ({ deck: { id } })) as DeckListItemResponse[],
  );
}

async function resync(): Promise<void> {
  await queryClient.refetchQueries({ queryKey: decksKeys.cardsStore(userId), exact: true });
}

function storedCards(): [string, string][] {
  return getDeckCardsCollection(queryClient, userId)
    .toArray.map((row): [string, string] => [row.deckId, row.cardId])
    .toSorted((a, b) => `${a[0]}${a[1]}`.localeCompare(`${b[0]}${b[1]}`));
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  reads = [];
  pages = [];
  vi.stubGlobal("location", { origin: "http://localhost" });
  vi.stubGlobal(
    "fetch",
    vi.fn((input: Request) => {
      const url = new URL(input.url);
      reads.push({
        since: url.searchParams.get("since"),
        cursor: url.searchParams.get("cursor"),
      });
      return Promise.resolve(Response.json(pages.shift() ?? { items: [] }));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  queryClient.clear();
});

describe("the deck cards store's watermark", () => {
  it("takes a full read when nothing is cached yet", async () => {
    serve({ items: [card("deck-1", "card-a")], syncedXid: "1000" });

    await getDeckCardsCollection(queryClient, userId).preload();

    expect(reads).toEqual([{ since: null, cursor: null }]);
  });

  it("sends the watermark of the previous read back", async () => {
    serve({ items: [card("deck-1", "card-a")], syncedXid: "1000" });
    await getDeckCardsCollection(queryClient, userId).preload();

    serve({ items: [], touchedDeckIds: [], syncedXid: "2000" });
    await resync();

    expect(reads.at(-1)?.since).toBe("1000");
  });
});

describe("merging a deck cards delta", () => {
  it("replaces a touched deck wholesale and keeps the other decks", async () => {
    serve({
      items: [card("deck-1", "card-a"), card("deck-2", "card-z")],
      syncedXid: "1000",
    });
    await getDeckCardsCollection(queryClient, userId).preload();

    serve({ items: [card("deck-1", "card-b")], touchedDeckIds: ["deck-1"], syncedXid: "2000" });
    await resync();

    expect(storedCards()).toEqual([
      ["deck-1", "card-b"],
      ["deck-2", "card-z"],
    ]);
  });

  it("keeps the rows of every page of a delta, not only the last one", async () => {
    serve({ items: [card("deck-1", "card-a")], syncedXid: "1000" });
    await getDeckCardsCollection(queryClient, userId).preload();

    serve(
      {
        items: [card("deck-1", "card-b")],
        touchedDeckIds: ["deck-1"],
        nextCursor: cursor,
        syncedXid: "2000",
      },
      { items: [card("deck-1", "card-c")], nextCursor: null },
    );
    await resync();

    expect(reads.at(-1)?.cursor).toBe(cursor);
    expect(storedCards()).toEqual([
      ["deck-1", "card-b"],
      ["deck-1", "card-c"],
    ]);
  });

  it("keeps nothing from the previous read when the server answers with a full list", async () => {
    serve({ items: [card("deck-1", "card-a")], syncedXid: "1000" });
    await getDeckCardsCollection(queryClient, userId).preload();

    serve({ items: [card("deck-2", "card-z")], syncedXid: "2000" });
    await resync();

    expect(storedCards()).toEqual([["deck-2", "card-z"]]);
  });
});

describe("a deck deleted on another device", () => {
  it("drops its cards once the decks store no longer lists it", async () => {
    decksOnServer("deck-1", "deck-2");
    serve({
      items: [card("deck-1", "card-a"), card("deck-2", "card-z")],
      syncedXid: "1000",
    });
    await getDeckCardsCollection(queryClient, userId).preload();

    decksOnServer("deck-1");
    serve({ items: [], touchedDeckIds: [], syncedXid: "2000" });
    await resync();

    expect(storedCards()).toEqual([["deck-1", "card-a"]]);
  });

  it("keeps every row while the decks store has never loaded", async () => {
    serve({
      items: [card("deck-1", "card-a"), card("deck-2", "card-z")],
      syncedXid: "1000",
    });
    await getDeckCardsCollection(queryClient, userId).preload();

    serve({ items: [], touchedDeckIds: [], syncedXid: "2000" });
    await resync();

    expect(storedCards()).toEqual([
      ["deck-1", "card-a"],
      ["deck-2", "card-z"],
    ]);
  });
});
