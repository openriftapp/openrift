import { isNotFound, isRedirect } from "@tanstack/react-router";
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
}) => Promise<void>;

function runLoader(deckId: string, session: SessionUser): Promise<void> {
  return (Route.options.loader as unknown as LoaderFn)({
    context: {
      queryClient: {
        query: (options) => Promise.resolve(options.queryKey[0] === "session" ? session : {}),
      },
    },
    params: { deckId },
    location: { href: `/decks/${deckId}` },
  });
}

async function thrownBy(promise: Promise<void>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("the loader resolved");
}

describe("/decks/$deckId loader", () => {
  beforeEach(() => {
    isLocalDeck.mockReturnValue(false);
    deckInStore.mockReset();
    deckInStore.mockReturnValue(true);
    refreshDeckStores.mockClear();
  });

  it("shows not found for a `local:` bookmark the browser no longer holds", async () => {
    expect(isNotFound(await thrownBy(runLoader(`local:${DECK_ID}`, null)))).toBe(true);
  });

  it("redirects a `local:` bookmark to the bare id while the deck is still here", async () => {
    isLocalDeck.mockReturnValue(true);

    const thrown = await thrownBy(runLoader(`local:${DECK_ID}`, null));

    expect(isRedirect(thrown)).toBe(true);
    expect(thrown).toMatchObject({ options: { params: { deckId: DECK_ID } } });
  });

  it("redirects a signed-in owner's `local:` bookmark to the deck they claimed", async () => {
    const thrown = await thrownBy(runLoader(`local:${DECK_ID}`, { user: { id: "user-1" } }));

    expect(isRedirect(thrown)).toBe(true);
    expect(thrown).toMatchObject({ options: { params: { deckId: DECK_ID } } });
  });

  it("sends a signed-out visitor to sign in for a bare id", async () => {
    const thrown = await thrownBy(runLoader(DECK_ID, null));

    expect(thrown).toMatchObject({ options: { to: "/login" } });
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
});
