// @vitest-environment jsdom
import { WellKnown } from "@openrift/shared/well-known";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const DECKS_KEY = "openrift-local-decks-v2";

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
