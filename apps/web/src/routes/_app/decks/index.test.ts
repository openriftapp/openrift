import { describe, expect, it, vi } from "vitest";

const { preloadLocalDecks, preloadServerCollection } = vi.hoisted(() => ({
  preloadLocalDecks: vi.fn(() => Promise.resolve()),
  preloadServerCollection: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/features/decks/lib/local-decks-collection", () => ({
  isLocalDeck: vi.fn(() => false),
  preloadLocalDecks,
}));

vi.mock("@/features/decks/lib/decks-collection", () => ({
  getDecksCollection: () => ({ preload: preloadServerCollection, has: () => true }),
  getDeckCardsCollection: () => ({ preload: preloadServerCollection }),
}));

const { Route } = await import("./index");
const { Route: DeckRoute } = await import("./$deckId");
const { Route: CompareRoute } = await import("./compare");
const { Route: ImportRoute } = await import("./import");
const { Route: ScanRoute } = await import("@/routes/_app/_authenticated/scan");
const { Route: ActivityRoute } = await import("@/routes/_app/_authenticated/collections/activity");
const { Route: StatsRoute } = await import("@/routes/_app/_authenticated/collections/stats");
const { Route: CollectionImportRoute } =
  await import("@/routes/_app/_authenticated/collections/import");
const { Route: StageRoute } = await import("@/routes/_app/stage");

type SessionUser = { user: { id: string } } | null;

type LoaderFn = (ctx: {
  context: { queryClient: { query: () => Promise<SessionUser> } };
}) => Promise<void>;

function runLoader(session: SessionUser): Promise<void> {
  return (Route.options.loader as unknown as LoaderFn)({
    context: { queryClient: { query: () => Promise.resolve(session) } },
  });
}

describe("/decks loader", () => {
  it("preloads the browser-local decks for a signed-out visitor", async () => {
    preloadLocalDecks.mockClear();

    await runLoader(null);

    expect(preloadLocalDecks).toHaveBeenCalledOnce();
  });

  it("preloads them next to the server decks for a signed-in user", async () => {
    preloadLocalDecks.mockClear();
    preloadServerCollection.mockClear();

    await runLoader({ user: { id: "user-1" } });

    expect(preloadLocalDecks).toHaveBeenCalledOnce();
    expect(preloadServerCollection).toHaveBeenCalledTimes(2);
  });
});

// These routes render only in the browser, so the loader runs with nothing on
// screen; without a pending component that window is a blank frame.
describe("client-only routes on a cold load", () => {
  it.each([
    { path: "/decks", pending: Route.options.pendingComponent },
    { path: "/decks/$deckId", pending: DeckRoute.options.pendingComponent },
    { path: "/decks/compare", pending: CompareRoute.options.pendingComponent },
    { path: "/decks/import", pending: ImportRoute.options.pendingComponent },
    { path: "/scan", pending: ScanRoute.options.pendingComponent },
    { path: "/collections/activity", pending: ActivityRoute.options.pendingComponent },
    { path: "/collections/stats", pending: StatsRoute.options.pendingComponent },
    { path: "/collections/import", pending: CollectionImportRoute.options.pendingComponent },
    { path: "/stage", pending: StageRoute.options.pendingComponent },
  ])("$path paints a pending state", ({ pending }) => {
    expect(pending).toBeDefined();
  });
});
