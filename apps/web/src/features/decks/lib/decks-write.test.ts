import type {
  DeckCardResponse,
  DeckCardWithDeckResponse,
  DeckListItemResponse,
  DeckResponse,
} from "@openrift/shared/types/api/deck";
import { WellKnown } from "@openrift/shared/well-known";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDeckCardsCollection, getDecksCollection } from "./decks-collection";
import { deckCardKey, saveDeckCards, updateDeck } from "./decks-write";

const userId = "user-1";

interface SentRequest {
  method: string;
  path: string;
  body: unknown;
}

let queryClient: QueryClient;
let serverDecks: DeckListItemResponse[];
let serverDeckCards: DeckCardWithDeckResponse[];
/** What the replace endpoint reports it stored; null echoes the request back. */
let storedCards: DeckCardResponse[] | null;
let sent: SentRequest[];
let respond: (request: SentRequest) => Response;

function deckFields(overrides: Partial<DeckResponse> = {}): DeckResponse {
  return {
    id: "deck-1",
    name: "Summoner Skirmish",
    description: null,
    format: WellKnown.deckFormat.CONSTRUCTED,
    formatConfig: null,
    isPublic: false,
    shareToken: null,
    isPinned: false,
    archivedAt: null,
    oddsConfig: null,
    coverCardId: null,
    coverPrintingId: null,
    coverPosition: null,
    links: [],
    collectionId: null,
    familyId: null,
    predecessorDeckId: null,
    isPrimary: false,
    isDraft: false,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  } as DeckResponse;
}

function stubDeckRow(overrides: Partial<DeckResponse> = {}): DeckListItemResponse {
  const deck = deckFields(overrides);
  return {
    deck: { ...deck, descriptionSnippet: deck.description },
    legendCardId: null,
    championCardId: null,
    totalCards: 0,
    typeCounts: [],
    domainDistribution: [],
    isValid: false,
    requiredProgress: 0,
    requiredTotal: 0,
    totalValueCents: null,
    missingCount: null,
    folderIds: [],
  } as unknown as DeckListItemResponse;
}

function succeed({ method, path, body }: SentRequest): Response {
  if (method === "GET" && path === "/api/v1/deck-cards") {
    return Response.json({ items: serverDeckCards, syncedXid: "1000" });
  }
  if (method === "GET") {
    return Response.json({ items: serverDecks });
  }
  if (method === "PUT" && path.endsWith("/cards")) {
    const { cards } = body as { cards: DeckCardResponse[] };
    return Response.json({ cards: storedCards ?? cards });
  }
  if (method === "POST" && path === "/api/v1/decks") {
    return Response.json(deckFields(body as Partial<DeckResponse>), { status: 201 });
  }
  if (method === "POST" && path.endsWith("/share")) {
    return Response.json({ shareToken: "token-1", isPublic: true });
  }
  if (method === "PATCH") {
    return Response.json(deckFields(body as Partial<DeckResponse>));
  }
  return new Response(null, { status: 204 });
}

async function bodyOf(request: Request): Promise<unknown> {
  const text = await request.clone().text();
  return text === "" ? undefined : JSON.parse(text);
}

async function decksOnServer(rows: DeckListItemResponse[]) {
  serverDecks = rows;
  const collection = getDecksCollection(queryClient, userId);
  await collection.preload();
  sent = [];
  return collection;
}

async function deckCardsOnServer(rows: DeckCardWithDeckResponse[]) {
  serverDeckCards = rows;
  const collection = getDeckCardsCollection(queryClient, userId);
  await collection.preload();
  sent = [];
  return collection;
}

/** The writes a test cares about, without the list read that seeded the store. */
function writes(): SentRequest[] {
  return sent.filter((request) => request.method !== "GET");
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  serverDecks = [];
  serverDeckCards = [];
  storedCards = null;
  sent = [];
  respond = succeed;
  vi.stubGlobal("location", { origin: "http://localhost" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      const request = {
        method: input.method,
        path: new URL(input.url).pathname,
        body: await bodyOf(input),
      };
      sent.push(request);
      return respond(request);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  queryClient.clear();
});

describe("persisting deck writes", () => {
  it("sends a new deck with the client id, so a replay resolves to the same deck", async () => {
    const collection = await decksOnServer([]);

    await collection.insert(stubDeckRow({ id: "deck-9", name: "Bandle Beatdown" })).isPersisted
      .promise;

    expect(writes()).toEqual([
      {
        method: "POST",
        path: "/api/v1/decks",
        body: {
          id: "deck-9",
          name: "Bandle Beatdown",
          description: null,
          links: [],
          format: WellKnown.deckFormat.CONSTRUCTED,
        },
      },
    ]);
    expect(collection.get("deck-9")?.deck.name).toBe("Bandle Beatdown");
  });

  it("removes a deleted deck from the store", async () => {
    const collection = await decksOnServer([stubDeckRow({ id: "deck-1" })]);

    await collection.delete("deck-1").isPersisted.promise;

    expect(writes()).toEqual([{ method: "DELETE", path: "/api/v1/decks/deck-1", body: undefined }]);
    expect(collection.has("deck-1")).toBe(false);
  });

  it("drops a deck the server no longer has instead of rolling the delete back", async () => {
    const collection = await decksOnServer([stubDeckRow({ id: "deck-1" })]);
    respond = (request) =>
      request.method === "DELETE"
        ? Response.json(
            { defined: true, code: "NOT_FOUND", status: 404, message: "Not Found" },
            { status: 404 },
          )
        : succeed(request);

    await collection.delete("deck-1").isPersisted.promise;

    expect(collection.has("deck-1")).toBe(false);
  });

  it("stores the share token the API issues", async () => {
    const collection = await decksOnServer([stubDeckRow({ id: "deck-1" })]);

    await collection.update("deck-1", (draft) => {
      draft.deck = { ...draft.deck, isPublic: true };
    }).isPersisted.promise;

    await vi.waitFor(() => {
      expect(collection.get("deck-1")?.deck).toMatchObject({
        isPublic: true,
        shareToken: "token-1",
      });
    });
  });

  it("sends only the fields an edit changed", async () => {
    const collection = await decksOnServer([stubDeckRow({ id: "deck-1", name: "Old" })]);

    await updateDeck(collection, "deck-1", { name: "New" }).isPersisted.promise;

    expect(writes()).toEqual([
      { method: "PATCH", path: "/api/v1/decks/deck-1", body: { name: "New" } },
    ]);
  });

  it("keeps the saved folder membership on the row once the write settles", async () => {
    const collection = await decksOnServer([stubDeckRow({ id: "deck-1" })]);

    await collection.update("deck-1", (draft) => {
      draft.folderIds = ["folder-1"];
    }).isPersisted.promise;

    expect(writes()).toEqual([
      { method: "PUT", path: "/api/v1/decks/deck-1/folders", body: { folderIds: ["folder-1"] } },
    ]);
    expect(collection.get("deck-1")?.folderIds).toEqual(["folder-1"]);
  });
});

describe("persisting deck card writes", () => {
  function card(cardId: string, quantity: number): DeckCardResponse {
    return { cardId, zone: WellKnown.deckZone.MAIN, quantity, preferredPrintingId: null };
  }

  function sentCards(): DeckCardResponse[] {
    const { cards } = (writes().at(0)?.body ?? { cards: [] }) as { cards: DeckCardResponse[] };
    return cards.toSorted((a, b) => a.cardId.localeCompare(b.cardId));
  }

  it("sends the deck's whole card list to the replace endpoint", async () => {
    const collection = await deckCardsOnServer([{ deckId: "deck-1", ...card("card-a", 1) }]);

    await saveDeckCards(collection, "deck-1", [card("card-a", 2), card("card-b", 1)], {
      queryClient,
      userId,
    }).isPersisted.promise;

    expect(writes().map((request) => [request.method, request.path])).toEqual([
      ["PUT", "/api/v1/decks/deck-1/cards"],
    ]);
    expect(sentCards()).toEqual([card("card-a", 2), card("card-b", 1)]);
  });

  it("sends a deck's untouched rows along when a write changes one of them", async () => {
    const collection = await deckCardsOnServer([
      { deckId: "deck-1", ...card("card-a", 1) },
      { deckId: "deck-1", ...card("card-b", 1) },
    ]);

    await saveDeckCards(collection, "deck-1", [card("card-a", 3), card("card-b", 1)], {
      queryClient,
      userId,
    }).isPersisted.promise;

    expect(sentCards()).toEqual([card("card-a", 3), card("card-b", 1)]);
    await vi.waitFor(() => {
      expect(
        collection.get(deckCardKey({ deckId: "deck-1", ...card("card-b", 1) }))?.quantity,
      ).toBe(1);
    });
  });

  it("sends the new quantity when a row is updated on the collection", async () => {
    const collection = await deckCardsOnServer([
      { deckId: "deck-1", ...card("card-a", 1) },
      { deckId: "deck-1", ...card("card-b", 1) },
    ]);

    await collection.update(deckCardKey({ deckId: "deck-1", ...card("card-a", 1) }), (draft) => {
      draft.quantity = 3;
    }).isPersisted.promise;

    expect(sentCards()).toEqual([card("card-a", 3), card("card-b", 1)]);
  });

  it("sends a card inserted on the collection", async () => {
    const collection = await deckCardsOnServer([{ deckId: "deck-1", ...card("card-a", 1) }]);

    await collection.insert({ deckId: "deck-1", ...card("card-b", 2) }).isPersisted.promise;

    expect(sentCards()).toEqual([card("card-a", 1), card("card-b", 2)]);
  });

  it("leaves a card deleted on the collection out of the write and the store", async () => {
    const collection = await deckCardsOnServer([
      { deckId: "deck-1", ...card("card-a", 1) },
      { deckId: "deck-1", ...card("card-b", 1) },
    ]);
    const deleted = deckCardKey({ deckId: "deck-1", ...card("card-b", 1) });

    await collection.delete(deleted).isPersisted.promise;

    expect(sentCards()).toEqual([card("card-a", 1)]);
    await vi.waitFor(() => {
      expect(collection.has(deleted)).toBe(false);
    });
  });

  it("drops a row the replace response no longer carries", async () => {
    const collection = await deckCardsOnServer([
      { deckId: "deck-1", ...card("card-a", 1) },
      { deckId: "deck-1", ...card("card-b", 1) },
    ]);
    storedCards = [card("card-a", 2)];

    await saveDeckCards(collection, "deck-1", [card("card-a", 2), card("card-b", 1)], {
      queryClient,
      userId,
    }).isPersisted.promise;

    await vi.waitFor(() => {
      expect(collection.toArray.map((row) => row.cardId)).toEqual(["card-a"]);
    });
  });

  it("empties a deck whose last card was removed", async () => {
    const collection = await deckCardsOnServer([{ deckId: "deck-1", ...card("card-a", 1) }]);
    storedCards = [];

    await saveDeckCards(collection, "deck-1", [], { queryClient, userId }).isPersisted.promise;

    expect(sentCards()).toEqual([]);
    await vi.waitFor(() => {
      expect(collection.toArray).toEqual([]);
    });
  });

  it("leaves another deck's cards alone", async () => {
    const collection = await deckCardsOnServer([
      { deckId: "deck-1", ...card("card-a", 1) },
      { deckId: "deck-2", ...card("card-z", 4) },
    ]);
    storedCards = [card("card-a", 3)];

    await saveDeckCards(collection, "deck-1", [card("card-a", 3)], {
      queryClient,
      userId,
    }).isPersisted.promise;

    expect(writes().map((request) => request.path)).toEqual(["/api/v1/decks/deck-1/cards"]);
    await vi.waitFor(() => {
      expect(collection.toArray.filter((row) => row.deckId === "deck-2")).toHaveLength(1);
    });
  });
});

describe("the list row's description snippet", () => {
  const long = `${"Grievous wounds spread across the rift. ".repeat(12)}end`;

  it("shortens a long description instead of parking the whole thing on the row", async () => {
    const collection = await decksOnServer([stubDeckRow({ id: "deck-1" })]);

    updateDeck(collection, "deck-1", { description: long });

    const snippet = collection.get("deck-1")?.deck.descriptionSnippet ?? "";
    expect(snippet.length).toBeLessThan(long.length);
    expect(snippet.endsWith("…")).toBe(true);
  });

  it("strips markdown the same way the server's snippet does", async () => {
    const collection = await decksOnServer([stubDeckRow({ id: "deck-1" })]);

    updateDeck(collection, "deck-1", {
      description: "**Bold** and [a link](https://example.test)",
    });

    expect(collection.get("deck-1")?.deck.descriptionSnippet).toBe("Bold and a link");
  });
});
