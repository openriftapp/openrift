// @vitest-environment jsdom
import { WellKnown } from "@openrift/shared/well-known";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const LEGACY_KEY = "openrift-local-decks";
const DECKS_KEY = "openrift-local-decks-v2";
const LEGACY_UUID = "0190aaaa-0000-7000-8000-000000000001";

// Seeded before the module loads: the migration runs once, on first preload.
localStorage.setItem(
  LEGACY_KEY,
  JSON.stringify({
    version: 0,
    state: {
      decks: {
        [`local:${LEGACY_UUID}`]: {
          id: `local:${LEGACY_UUID}`,
          name: "Legacy Deck",
          description: "",
          format: WellKnown.deckFormat.CONSTRUCTED,
          formatConfig: null,
          cards: [{ zone: "main", cardId: "card-a", quantity: 2, preferredPrintingId: null }],
          coverCardId: null,
          coverPrintingId: null,
          coverPosition: null,
          links: [],
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
        },
      },
    },
  }),
);

const {
  clearImportedLocalDecks,
  createLocalDeck,
  deleteLocalDeck,
  duplicateLocalDeck,
  getLocalDecksCollection,
  isLocalDeck,
  preloadLocalDecks,
  setLocalDeckCards,
  updateLocalDeck,
  writeLocalDecksItem,
} = await import("@/features/decks/lib/local-decks-collection");

await preloadLocalDecks();

describe("legacy migration", () => {
  it("re-keys a `local:` deck onto the uuid it wrapped", () => {
    expect(isLocalDeck(LEGACY_UUID)).toBe(true);
    expect(isLocalDeck(`local:${LEGACY_UUID}`)).toBe(false);
    expect(getLocalDecksCollection().get(LEGACY_UUID)).toMatchObject({
      id: LEGACY_UUID,
      name: "Legacy Deck",
      cards: [{ cardId: "card-a", quantity: 2 }],
    });
  });

  it("leaves the legacy key in place so a rollback still finds its decks", () => {
    expect(localStorage.getItem(LEGACY_KEY)).not.toBeNull();
  });
});

describe("local deck writes", () => {
  it("creates a deck under a bare uuid", () => {
    const id = createLocalDeck(WellKnown.deckFormat.CONSTRUCTED, "My Deck");

    expect(id.startsWith("local:")).toBe(false);
    expect(isLocalDeck(id)).toBe(true);
    expect(getLocalDecksCollection().get(id)).toMatchObject({ name: "My Deck", cards: [] });

    deleteLocalDeck(id);
    expect(isLocalDeck(id)).toBe(false);
  });

  it("applies only the keys a patch sets", () => {
    const id = createLocalDeck(WellKnown.deckFormat.CONSTRUCTED, "Before");
    updateLocalDeck(id, { name: "After" });

    expect(getLocalDecksCollection().get(id)).toMatchObject({
      name: "After",
      format: WellKnown.deckFormat.CONSTRUCTED,
    });

    deleteLocalDeck(id);
  });

  it("replaces the card list", () => {
    const id = createLocalDeck(WellKnown.deckFormat.CONSTRUCTED);
    setLocalDeckCards(id, [
      { zone: "main", cardId: "card-b", quantity: 3, preferredPrintingId: null },
    ]);

    expect(getLocalDecksCollection().get(id)?.cards).toEqual([
      { zone: "main", cardId: "card-b", quantity: 3, preferredPrintingId: null },
    ]);

    deleteLocalDeck(id);
  });

  it("duplicates a deck under a new id and copies its cards", () => {
    const id = createLocalDeck(WellKnown.deckFormat.CONSTRUCTED, "Original");
    setLocalDeckCards(id, [
      { zone: "main", cardId: "card-c", quantity: 1, preferredPrintingId: null },
    ]);

    const copyId = duplicateLocalDeck(id);
    expect(copyId).not.toBeNull();
    expect(copyId).not.toBe(id);
    expect(getLocalDecksCollection().get(copyId ?? "")?.cards).toEqual([
      { zone: "main", cardId: "card-c", quantity: 1, preferredPrintingId: null },
    ]);

    deleteLocalDeck(id);
    deleteLocalDeck(copyId ?? "");
  });

  it("ignores writes to an unknown deck", () => {
    expect(() => {
      updateLocalDeck("missing", { name: "x" });
    }).not.toThrow();
    expect(() => {
      setLocalDeckCards("missing", []);
    }).not.toThrow();
    expect(() => {
      deleteLocalDeck("missing");
    }).not.toThrow();
    expect(duplicateLocalDeck("missing")).toBeNull();
  });

  it("clears only the ids that were imported", () => {
    const keep = createLocalDeck(WellKnown.deckFormat.CONSTRUCTED, "keep");
    const drop = createLocalDeck(WellKnown.deckFormat.CONSTRUCTED, "drop");

    clearImportedLocalDecks([drop, "missing"]);

    expect(isLocalDeck(keep)).toBe(true);
    expect(isLocalDeck(drop)).toBe(false);

    deleteLocalDeck(keep);
  });
});

describe("writeLocalDecksItem", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
  });

  it("writes through and returns true on success", () => {
    const setItem = vi.fn();

    expect(writeLocalDecksItem({ setItem }, "k", "v")).toBe(true);
    expect(setItem).toHaveBeenCalledWith("k", "v");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("toasts and returns false when the quota is exceeded", () => {
    const setItem = vi.fn(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    expect(writeLocalDecksItem({ setItem }, "k", "v")).toBe(false);
    expect(toast.error).toHaveBeenCalledOnce();
  });

  it("rethrows non-quota errors", () => {
    const setItem = vi.fn(() => {
      throw new Error("boom");
    });

    expect(() => writeLocalDecksItem({ setItem }, "k", "v")).toThrow("boom");
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("legacy import runs once", () => {
  async function reloadModule() {
    vi.resetModules();
    const module = await import("@/features/decks/lib/local-decks-collection");
    await module.preloadLocalDecks();
    return module.getLocalDecksCollection();
  }

  it("keeps one copy of a deck a previous load already imported", async () => {
    const collection = await reloadModule();

    expect(collection.toArray.filter((deck) => deck.id === LEGACY_UUID)).toHaveLength(1);
  });

  it("leaves the store empty after the decks were claimed into an account", async () => {
    const collection = getLocalDecksCollection();
    const ids = collection.toArray.map((deck) => deck.id);
    expect(ids.length).toBeGreaterThan(0);
    await collection.delete(ids).isPersisted.promise;

    const reloaded = await reloadModule();

    expect(reloaded.size).toBe(0);
  });
});

describe("concurrent preloads", () => {
  it("share one migration, so both see the legacy deck and it is inserted once", async () => {
    vi.resetModules();
    const setup = await import("@/features/decks/lib/local-decks-collection");
    await setup.preloadLocalDecks();
    const existing = setup.getLocalDecksCollection().toArray.map((deck) => deck.id);
    if (existing.length > 0) {
      await setup.getLocalDecksCollection().delete(existing).isPersisted.promise;
    }
    localStorage.removeItem("openrift-local-decks-migrated");

    vi.resetModules();
    const fresh = await import("@/features/decks/lib/local-decks-collection");

    await Promise.all([fresh.preloadLocalDecks(), fresh.preloadLocalDecks()]);

    const collection = fresh.getLocalDecksCollection();
    expect(collection.has(LEGACY_UUID)).toBe(true);
    expect(collection.toArray.filter((deck) => deck.id === LEGACY_UUID)).toHaveLength(1);
  });
});

describe("a local write the browser refuses", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rolls the deck back instead of leaving it as stored", async () => {
    vi.mocked(toast.error).mockClear();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    const id = createLocalDeck(WellKnown.deckFormat.CONSTRUCTED, "Too big");

    await vi.waitFor(() => {
      expect(isLocalDeck(id)).toBe(false);
    });
    expect(toast.error).toHaveBeenCalledOnce();
  });
});

describe("a write before anything read the store", () => {
  it("keeps the decks already stored", async () => {
    const stored = createLocalDeck(WellKnown.deckFormat.CONSTRUCTED, "Stored");
    await vi.waitFor(() => {
      expect(localStorage.getItem(DECKS_KEY)).toContain(stored);
    });

    vi.resetModules();
    const fresh = await import("@/features/decks/lib/local-decks-collection");
    const added = fresh.createLocalDeck(WellKnown.deckFormat.CONSTRUCTED, "Added");

    await vi.waitFor(() => {
      expect(localStorage.getItem(DECKS_KEY)).toContain(added);
    });
    expect(localStorage.getItem(DECKS_KEY)).toContain(stored);

    fresh.deleteLocalDeck(added);
    deleteLocalDeck(stored);
  });
});

describe("a legacy import the browser refuses", () => {
  const MIGRATED_KEY = "openrift-local-decks-migrated";

  async function reloadModule() {
    vi.resetModules();
    const module = await import("@/features/decks/lib/local-decks-collection");
    await module.preloadLocalDecks();
    return module.getLocalDecksCollection();
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("leaves a deck it could not store unclaimed, so the next load retries it", async () => {
    const collection = getLocalDecksCollection();
    const ids = collection.toArray.map((deck) => deck.id);
    if (ids.length > 0) {
      await collection.delete(ids).isPersisted.promise;
    }
    localStorage.removeItem(MIGRATED_KEY);
    const write = Storage.prototype.setItem.bind(localStorage);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key: string, value: string) => {
      if (key === DECKS_KEY) {
        throw new DOMException("full", "QuotaExceededError");
      }
      write(key, value);
    });

    await reloadModule();

    const claimed: unknown = JSON.parse(localStorage.getItem(MIGRATED_KEY) ?? "[]");
    expect(claimed).not.toContain(LEGACY_UUID);

    vi.restoreAllMocks();
    const retried = await reloadModule();
    expect(retried.has(LEGACY_UUID)).toBe(true);
  });
});
