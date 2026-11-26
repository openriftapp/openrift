import { isNotFound } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { isLocalDeck, preloadLocalDecks } = vi.hoisted(() => ({
  isLocalDeck: vi.fn((_deckId: string) => false),
  preloadLocalDecks: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/features/decks/lib/local-decks-collection", () => ({ isLocalDeck, preloadLocalDecks }));

const { deckInStore, refreshDeckStores } = vi.hoisted(() => ({
  deckInStore: vi.fn((_queryClient: unknown, _userId: string, _deckId: string) => true),
  refreshDeckStores: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/features/decks/lib/decks-collection", () => ({
  getDecksCollection: () => ({ preload: () => Promise.resolve() }),
  getDeckCardsCollection: () => ({ preload: () => Promise.resolve() }),
  deckInStore,
  refreshDeckStores,
}));

const { Route } = await import("./$deckId");

const DECK_ID = "0190aaaa-0000-7000-8000-000000000001";

type SessionUser = { user: { id: string } } | null;

type LoaderFn = (ctx: {
  context: {
    queryClient: { query: (options: { queryKey: readonly unknown[] }) => Promise<unknown> };
  };
  params: { deckId: string };
  location: { href: string };
}) => Promise<unknown>;

const queried: (readonly unknown[])[] = [];

function runLoader(deckId: string, session: SessionUser): Promise<unknown> {
  return (Route.options.loader as unknown as LoaderFn)({
    context: {
      queryClient: {
        query: (options) => {
          queried.push(options.queryKey);
          return Promise.resolve(options.queryKey[0] === "session" ? session : {});
        },
      },
    },
    params: { deckId },
    location: { href: `/decks/${deckId}` },
  });
}

async function thrownBy(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("the loader resolved");
}

describe("/decks/$deckId loader", () => {
  beforeEach(() => {
    queried.length = 0;
    isLocalDeck.mockReturnValue(false);
    deckInStore.mockReset();
    deckInStore.mockReturnValue(true);
    refreshDeckStores.mockClear();
  });

  it("asks the page to send a signed-out visitor to sign in for a bare id", async () => {
    await expect(runLoader(DECK_ID, null)).resolves.toEqual({
      signIn: { redirect: `/decks/${DECK_ID}`, email: undefined },
    });
    expect(deckInStore).not.toHaveBeenCalled();
  });

  it("loads the deck when the store holds it", async () => {
    await expect(runLoader(DECK_ID, { user: { id: "user-1" } })).resolves.toBeUndefined();

    expect(refreshDeckStores).not.toHaveBeenCalled();
  });

  it("reads the stores again for a deck they have not seen, such as a fresh variant", async () => {
    deckInStore.mockReturnValueOnce(false);

    await expect(runLoader(DECK_ID, { user: { id: "user-1" } })).resolves.toBeUndefined();

    expect(refreshDeckStores).toHaveBeenCalledOnce();
    expect(deckInStore).toHaveBeenLastCalledWith(expect.anything(), "user-1", DECK_ID);
  });

  it("shows not found when the server has no deck under that id either", async () => {
    deckInStore.mockReturnValue(false);

    const thrown = await thrownBy(runLoader(DECK_ID, { user: { id: "user-1" } }));

    expect(isNotFound(thrown)).toBe(true);
    expect(refreshDeckStores).toHaveBeenCalledOnce();
  });

  it("loads the custom tag assignments the deck rules read", async () => {
    isLocalDeck.mockReturnValue(true);
    await runLoader(DECK_ID, null);
    expect(queried).toContainEqual(["custom-tags"]);
  });
});
