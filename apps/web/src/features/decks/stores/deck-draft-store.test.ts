// @vitest-environment happy-dom
import { WellKnown } from "@openrift/shared/well-known";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toDraftDeckCard } from "@/features/decks/lib/deck-builder-card";
import { createEmptyPlanDraft } from "@/features/decks/lib/deck-plan";
import {
  createLocalDeck,
  getLocalDecksCollection,
  preloadLocalDecks,
} from "@/features/decks/lib/local-decks-collection";
import { useDeckUndoStore } from "@/features/decks/stores/deck-undo-store";
import { resetIdCounter, stubDeckBuilderCard } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

import {
  flushDeckDraft,
  getDeckDraftCollection,
  getDeckDraftHydrated,
  getDeckDraftHasConflict,
  getDeckDraftStatus,
  getDeckPlanDraft,
  hydrateDeckDraft,
  resetDeckDraft,
  resolveDeckDraftConflict,
  setDeckPlanDraft,
  syncDeckDraft,
} from "./deck-draft-store";

await preloadLocalDecks();

function clearLocalDecks() {
  const rows = getLocalDecksCollection().toArray;
  if (rows.length > 0) {
    getLocalDecksCollection().delete(rows.map((deck) => deck.id));
  }
}

// `vi.hoisted` keeps the spy available to the hoisted `vi.mock` factory below.
const { saveDeckCardsSpy, ConflictError } = vi.hoisted(() => ({
  saveDeckCardsSpy: vi.fn((..._args: unknown[]) => ({
    when: () => Promise.resolve(),
  })),
  ConflictError: class extends Error {
    readonly version: string;
    readonly cards: { cardId: string; zone: string; quantity: number }[];

    constructor(version: string, cards: { cardId: string; zone: string; quantity: number }[]) {
      super("conflict");
      this.version = version;
      this.cards = cards;
    }
  },
}));
vi.mock("@/features/decks/lib/decks-write", () => ({
  saveDeckCards: (...args: unknown[]) => saveDeckCardsSpy(...args),
  DeckCardsConflictError: ConflictError,
}));
vi.mock("@/features/decks/lib/decks-collection", () => ({
  getDeckCardsCollection: () => ({ preload: () => Promise.resolve() }),
}));

let queryClient: QueryClient;

const userA = "user-a";
const userB = "user-b";

beforeEach(() => {
  resetIdCounter();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

afterEach(() => {
  queryClient.clear();
});

describe("getDeckDraftCollection", () => {
  it("returns the same collection for the same (userId, deckId) on the same client", () => {
    const a = getDeckDraftCollection(queryClient, userA, "deck-1");
    const b = getDeckDraftCollection(queryClient, userA, "deck-1");
    expect(a).toBe(b);
  });

  it("returns distinct collections for different deck ids under the same user", () => {
    const a = getDeckDraftCollection(queryClient, userA, "deck-1");
    const b = getDeckDraftCollection(queryClient, userA, "deck-2");
    expect(a).not.toBe(b);
  });

  it("returns distinct collections for the same deck id under different users", () => {
    const a = getDeckDraftCollection(queryClient, userA, "deck-1");
    const b = getDeckDraftCollection(queryClient, userB, "deck-1");
    expect(a).not.toBe(b);
  });

  it("isolates collections across QueryClients", () => {
    const a = getDeckDraftCollection(queryClient, userA, "deck-1");
    const other = new QueryClient();
    const b = getDeckDraftCollection(other, userA, "deck-1");
    expect(a).not.toBe(b);
    other.clear();
  });

  it("orphans previous-user drafts when the active user changes", async () => {
    const previous = getDeckDraftCollection(queryClient, userA, "deck-1");
    const cleanupSpy = vi.spyOn(previous, "cleanup");
    expect(previous.status).not.toBe("cleaned-up");

    // No live-query subscribers attached, so cleanup runs synchronously.
    getDeckDraftCollection(queryClient, userB, "deck-1");

    await vi.waitFor(() => expect(cleanupSpy).toHaveBeenCalled());
  });
});

describe("hydrateDeckDraft", () => {
  it("seeds a fresh collection with the given cards", () => {
    const cards = [
      stubDeckBuilderCard({ cardId: "c1", zone: "main", quantity: 2 }),
      stubDeckBuilderCard({ cardId: "c2", zone: "sideboard", quantity: 1 }),
    ];
    hydrateDeckDraft(queryClient, userA, "deck-hydrate-fresh", cards);
    const stored = [...getDeckDraftCollection(queryClient, userA, "deck-hydrate-fresh").values()];
    expect(stored).toHaveLength(2);
    expect(stored.map((c) => c.cardId).toSorted()).toEqual(["c1", "c2"]);
  });

  it("replaces existing contents when re-hydrated", () => {
    hydrateDeckDraft(queryClient, userA, "deck-hydrate-replace", [
      stubDeckBuilderCard({ cardId: "old", zone: "main", quantity: 3 }),
    ]);
    hydrateDeckDraft(queryClient, userA, "deck-hydrate-replace", [
      stubDeckBuilderCard({ cardId: "new", zone: "sideboard", quantity: 1 }),
    ]);
    const stored = [...getDeckDraftCollection(queryClient, userA, "deck-hydrate-replace").values()];
    expect(stored).toHaveLength(1);
    expect(stored[0]!.cardId).toBe("new");
  });

  it("updates the quantity of matching entries in place", () => {
    hydrateDeckDraft(queryClient, userA, "deck-hydrate-update", [
      stubDeckBuilderCard({ cardId: "c1", zone: "main", quantity: 1 }),
    ]);
    hydrateDeckDraft(queryClient, userA, "deck-hydrate-update", [
      stubDeckBuilderCard({ cardId: "c1", zone: "main", quantity: 3 }),
    ]);
    const stored = [...getDeckDraftCollection(queryClient, userA, "deck-hydrate-update").values()];
    expect(stored[0]!.quantity).toBe(3);
  });

  it("keeps the same collection instance when re-hydrated", () => {
    const first = getDeckDraftCollection(queryClient, userA, "deck-hydrate-same");
    hydrateDeckDraft(queryClient, userA, "deck-hydrate-same", [
      stubDeckBuilderCard({ cardId: "c1", zone: "main" }),
    ]);
    const second = getDeckDraftCollection(queryClient, userA, "deck-hydrate-same");
    expect(second).toBe(first);
  });
});

describe("persistence sink (ADR-035 local decks)", () => {
  beforeEach(() => {
    clearLocalDecks();
    vi.useFakeTimers();
    saveDeckCardsSpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearLocalDecks();
  });

  it("writes a local deck's cards to the local store and never calls the server", async () => {
    const localId = createLocalDeck(WellKnown.deckFormat.CONSTRUCTED);
    const collection = getDeckDraftCollection(queryClient, "local", localId);

    collection.insert(stubDeckBuilderCard({ cardId: "card-a", zone: "main", quantity: 2 }));
    await vi.advanceTimersByTimeAsync(1000);

    expect(saveDeckCardsSpy).not.toHaveBeenCalled();
    expect(getLocalDecksCollection().get(localId)?.cards).toEqual([
      { cardId: "card-a", zone: "main", quantity: 2, preferredPrintingId: null },
    ]);
  });

  it("writes a server deck's cards through the deck-cards store", async () => {
    const collection = getDeckDraftCollection(queryClient, "user-save", "server-deck-1");

    collection.insert(stubDeckBuilderCard({ cardId: "card-b", zone: "main", quantity: 1 }));
    await vi.advanceTimersByTimeAsync(1000);

    expect(saveDeckCardsSpy).toHaveBeenCalledOnce();
    expect(saveDeckCardsSpy).toHaveBeenCalledWith(
      expect.anything(),
      "server-deck-1",
      [expect.objectContaining({ cardId: "card-b", quantity: 1 })],
      expect.objectContaining({ userId: "user-save" }),
      expect.objectContaining({ expectedVersion: undefined }),
    );
  });
});

describe("resetDeckDraft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    saveDeckCardsSpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks a hydrated draft as stale so the editor re-hydrates it", () => {
    hydrateDeckDraft(queryClient, userA, "deck-reset", [
      stubDeckBuilderCard({ cardId: "old", zone: "main" }),
    ]);
    expect(getDeckDraftHydrated(queryClient, userA, "deck-reset")).toBe(true);

    resetDeckDraft(queryClient, userA, "deck-reset");

    expect(getDeckDraftHydrated(queryClient, userA, "deck-reset")).toBe(false);
  });

  it("drops a pending debounced save", async () => {
    hydrateDeckDraft(queryClient, userA, "deck-reset-pending", []);
    getDeckDraftCollection(queryClient, userA, "deck-reset-pending").insert(
      stubDeckBuilderCard({ cardId: "edit", zone: "main" }),
    );

    resetDeckDraft(queryClient, userA, "deck-reset-pending");
    await vi.advanceTimersByTimeAsync(1000);

    expect(saveDeckCardsSpy).not.toHaveBeenCalled();
  });

  it("leaves no error behind when it aborts an in-flight save", async () => {
    saveDeckCardsSpy.mockImplementationOnce(() => ({
      when: () => new Promise<void>(() => {}),
    }));
    hydrateDeckDraft(queryClient, userA, "deck-reset-inflight", []);
    getDeckDraftCollection(queryClient, userA, "deck-reset-inflight").insert(
      stubDeckBuilderCard({ cardId: "edit", zone: "main" }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(saveDeckCardsSpy).toHaveBeenCalledOnce();

    resetDeckDraft(queryClient, userA, "deck-reset-inflight");
    await vi.advanceTimersByTimeAsync(0);

    expect(getDeckDraftStatus(queryClient, userA, "deck-reset-inflight")).toEqual({
      isSaving: false,
      isDirty: false,
      error: null,
    });
  });

  it("does nothing for a draft under another scope", () => {
    hydrateDeckDraft(queryClient, userA, "deck-reset-scope", []);

    resetDeckDraft(queryClient, userB, "deck-reset-scope");

    expect(getDeckDraftHydrated(queryClient, userA, "deck-reset-scope")).toBe(true);
  });
});

describe("flushDeckDraft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    saveDeckCardsSpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs a pending debounced save without waiting out the debounce", async () => {
    hydrateDeckDraft(queryClient, userA, "deck-flush", []);
    getDeckDraftCollection(queryClient, userA, "deck-flush").insert(
      stubDeckBuilderCard({ cardId: "edit", zone: "main" }),
    );

    flushDeckDraft(queryClient, userA, "deck-flush");
    await vi.advanceTimersByTimeAsync(0);

    expect(saveDeckCardsSpy).toHaveBeenCalledOnce();
    expect(getDeckDraftStatus(queryClient, userA, "deck-flush").isDirty).toBe(false);

    await vi.advanceTimersByTimeAsync(1000);
    expect(saveDeckCardsSpy).toHaveBeenCalledOnce();
  });

  it("does nothing when no save is pending", async () => {
    hydrateDeckDraft(queryClient, userA, "deck-flush-clean", []);

    flushDeckDraft(queryClient, userA, "deck-flush-clean");
    await vi.advanceTimersByTimeAsync(0);

    expect(saveDeckCardsSpy).not.toHaveBeenCalled();
  });

  it("does nothing for a draft under another scope", async () => {
    hydrateDeckDraft(queryClient, userA, "deck-flush-scope", []);
    getDeckDraftCollection(queryClient, userA, "deck-flush-scope").insert(
      stubDeckBuilderCard({ cardId: "edit", zone: "main" }),
    );

    flushDeckDraft(queryClient, userB, "deck-flush-scope");
    await vi.advanceTimersByTimeAsync(0);

    expect(saveDeckCardsSpy).not.toHaveBeenCalled();
  });
});

describe("plan draft", () => {
  it("keeps an unsaved plan for the deck it belongs to", () => {
    const draft = { ...createEmptyPlanDraft(), generalStrategy: "Pressure early" };

    setDeckPlanDraft(queryClient, userA, "deck-plan", draft);

    expect(getDeckPlanDraft(queryClient, userA, "deck-plan")).toBe(draft);
    expect(getDeckPlanDraft(queryClient, userA, "deck-plan-other")).toBeNull();
  });

  it("drops the plan when cleared", () => {
    setDeckPlanDraft(queryClient, userA, "deck-plan-clear", createEmptyPlanDraft());

    setDeckPlanDraft(queryClient, userA, "deck-plan-clear", null);

    expect(getDeckPlanDraft(queryClient, userA, "deck-plan-clear")).toBeNull();
  });

  it("survives a card re-hydration of the same deck", () => {
    const draft = createEmptyPlanDraft();
    setDeckPlanDraft(queryClient, userA, "deck-plan-hydrate", draft);

    hydrateDeckDraft(queryClient, userA, "deck-plan-hydrate", []);

    expect(getDeckPlanDraft(queryClient, userA, "deck-plan-hydrate")).toBe(draft);
  });

  it("does not leak a plan to another user", () => {
    setDeckPlanDraft(queryClient, userA, "deck-plan-user", createEmptyPlanDraft());

    expect(getDeckPlanDraft(queryClient, userB, "deck-plan-user")).toBeNull();
  });
});

describe("syncDeckDraft", () => {
  const resetUndo = createStoreResetter(useDeckUndoStore);
  const deckId = "deck-sync";

  beforeEach(() => {
    vi.useFakeTimers();
    saveDeckCardsSpy.mockClear();
    resetUndo();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearLocalDecks();
  });

  function draftCards(scope = userA, id = deckId): string[] {
    return [...getDeckDraftCollection(queryClient, scope, id).values()]
      .map((card) => `${card.cardId}x${card.quantity}`)
      .toSorted();
  }

  function deferredSave(): { settle: () => void; fail: () => void } {
    const handle = { settle: () => {}, fail: () => {} };
    saveDeckCardsSpy.mockImplementationOnce(() => ({
      when: () =>
        new Promise<void>((resolve, reject) => {
          handle.settle = resolve;
          handle.fail = () => reject(new Error("offline"));
        }),
    }));
    return handle;
  }

  function editDraft(card: ReturnType<typeof stubDeckBuilderCard>): void {
    getDeckDraftCollection(queryClient, userA, deckId).insert(card);
  }

  const viktor = stubDeckBuilderCard({ cardId: "viktor", quantity: 3 });
  const jinx = stubDeckBuilderCard({ cardId: "jinx", quantity: 2 });
  const ahri = stubDeckBuilderCard({ cardId: "ahri", quantity: 1 });

  it("rebuilds a clean draft from changed stored cards without saving", async () => {
    syncDeckDraft(queryClient, userA, deckId, [viktor]);
    useDeckUndoStore.getState().record(deckId, [viktor]);

    syncDeckDraft(queryClient, userA, deckId, [viktor, jinx]);
    await vi.advanceTimersByTimeAsync(1000);

    expect(draftCards()).toEqual(["jinxx2", "viktorx3"]);
    expect(getDeckDraftHasConflict(queryClient, userA, deckId)).toBe(false);
    expect(useDeckUndoStore.getState().past).toEqual([]);
    expect(saveDeckCardsSpy).not.toHaveBeenCalled();
  });

  it("holds a conflict for a dirty draft and its save until the player decides", async () => {
    syncDeckDraft(queryClient, userA, deckId, [viktor]);
    editDraft(ahri);

    syncDeckDraft(queryClient, userA, deckId, [viktor, jinx]);
    await vi.advanceTimersByTimeAsync(1000);

    expect(getDeckDraftHasConflict(queryClient, userA, deckId)).toBe(true);
    expect(draftCards()).toEqual(["ahrix1", "viktorx3"]);
    expect(saveDeckCardsSpy).not.toHaveBeenCalled();
    expect(getDeckDraftStatus(queryClient, userA, deckId).isDirty).toBe(true);
  });

  it("asks once per stored version", () => {
    syncDeckDraft(queryClient, userA, deckId, [viktor]);
    editDraft(ahri);
    syncDeckDraft(queryClient, userA, deckId, [viktor, jinx]);

    resolveDeckDraftConflict(queryClient, userA, deckId, "keep");
    syncDeckDraft(queryClient, userA, deckId, [viktor, jinx]);

    expect(getDeckDraftHasConflict(queryClient, userA, deckId)).toBe(false);
  });

  it("saves the player's version when they keep it", async () => {
    syncDeckDraft(queryClient, userA, deckId, [viktor]);
    editDraft(ahri);
    syncDeckDraft(queryClient, userA, deckId, [viktor, jinx]);
    await vi.advanceTimersByTimeAsync(1000);

    resolveDeckDraftConflict(queryClient, userA, deckId, "keep");
    await vi.advanceTimersByTimeAsync(0);

    expect(saveDeckCardsSpy).toHaveBeenCalledOnce();
    expect(saveDeckCardsSpy.mock.calls[0]?.[2]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cardId: "ahri" }),
        expect.objectContaining({ cardId: "viktor" }),
      ]),
    );
  });

  it("replaces the draft and its undo history when the player loads the stored version", async () => {
    syncDeckDraft(queryClient, userA, deckId, [viktor]);
    editDraft(ahri);
    useDeckUndoStore.getState().record(deckId, [viktor]);
    syncDeckDraft(queryClient, userA, deckId, [viktor, jinx]);

    resolveDeckDraftConflict(queryClient, userA, deckId, "load");
    await vi.advanceTimersByTimeAsync(1000);

    expect(draftCards()).toEqual(["jinxx2", "viktorx3"]);
    expect(getDeckDraftHasConflict(queryClient, userA, deckId)).toBe(false);
    expect(getDeckDraftStatus(queryClient, userA, deckId).isDirty).toBe(false);
    expect(useDeckUndoStore.getState().past).toEqual([]);
    expect(saveDeckCardsSpy).not.toHaveBeenCalled();
  });

  it("ignores the echo of its own save while it is in flight and after it lands", async () => {
    const save = deferredSave();
    syncDeckDraft(queryClient, userA, deckId, [viktor]);
    editDraft(jinx);
    await vi.advanceTimersByTimeAsync(1000);

    syncDeckDraft(queryClient, userA, deckId, [viktor, jinx]);
    editDraft(ahri);
    save.settle();
    await vi.advanceTimersByTimeAsync(0);
    syncDeckDraft(queryClient, userA, deckId, [viktor, jinx]);

    expect(getDeckDraftHasConflict(queryClient, userA, deckId)).toBe(false);
    expect(draftCards()).toEqual(["ahrix1", "jinxx2", "viktorx3"]);
  });

  it("keeps the player's edits when a failed save rolls the stored cards back", async () => {
    const save = deferredSave();
    syncDeckDraft(queryClient, userA, deckId, [viktor]);
    editDraft(jinx);
    await vi.advanceTimersByTimeAsync(1000);
    syncDeckDraft(queryClient, userA, deckId, [viktor, jinx]);

    save.fail();
    await vi.advanceTimersByTimeAsync(0);
    syncDeckDraft(queryClient, userA, deckId, [viktor]);

    expect(getDeckDraftHasConflict(queryClient, userA, deckId)).toBe(false);
    expect(draftCards()).toEqual(["jinxx2", "viktorx3"]);
  });

  it("decides on a change that arrived during a save once the save settles", async () => {
    const save = deferredSave();
    syncDeckDraft(queryClient, userA, deckId, [viktor]);
    editDraft(jinx);
    await vi.advanceTimersByTimeAsync(1000);

    syncDeckDraft(queryClient, userA, deckId, [viktor, ahri]);
    expect(getDeckDraftHasConflict(queryClient, userA, deckId)).toBe(false);
    save.fail();
    await vi.advanceTimersByTimeAsync(0);

    expect(getDeckDraftHasConflict(queryClient, userA, deckId)).toBe(true);
  });

  function storingSave(version: string): void {
    saveDeckCardsSpy.mockImplementationOnce((...args: unknown[]) => {
      (args[4] as { onVersion: (stored: string) => void }).onVersion(version);
      return { when: () => Promise.resolve() };
    });
  }

  function refusedSave(version: string, stored: ReturnType<typeof stubDeckBuilderCard>[]): void {
    saveDeckCardsSpy.mockImplementationOnce(() => ({
      when: () => Promise.reject(new ConflictError(version, stored)),
    }));
  }

  function expectedVersionOfCall(index: number): unknown {
    const versioning = saveDeckCardsSpy.mock.calls[index]?.[4] as
      | { expectedVersion?: string }
      | undefined;
    return versioning?.expectedVersion;
  }

  it("names the stored version it was hydrated with on the first save", async () => {
    syncDeckDraft(queryClient, userA, deckId, [viktor], "30");
    editDraft(jinx);
    await vi.advanceTimersByTimeAsync(1000);

    expect(expectedVersionOfCall(0)).toBe("30");
  });

  it("holds a conflict when the first save meets another device's change", async () => {
    syncDeckDraft(queryClient, userA, deckId, [viktor], "30");
    refusedSave("57", [viktor, ahri]);
    editDraft(jinx);
    await vi.advanceTimersByTimeAsync(1000);
    syncDeckDraft(queryClient, userA, deckId, [viktor, ahri], "57");

    expect(saveDeckCardsSpy).toHaveBeenCalledOnce();
    expect(getDeckDraftHasConflict(queryClient, userA, deckId)).toBe(true);
    expect(draftCards()).toEqual(["jinxx2", "viktorx3"]);
  });

  it("takes the stored version along when a clean draft follows changed cards", async () => {
    syncDeckDraft(queryClient, userA, deckId, [viktor], "30");
    syncDeckDraft(queryClient, userA, deckId, [viktor, ahri], "44");

    editDraft(jinx);
    await vi.advanceTimersByTimeAsync(1000);

    expect(expectedVersionOfCall(0)).toBe("44");
  });

  it("takes the stored version along when the player loads it", async () => {
    syncDeckDraft(queryClient, userA, deckId, [viktor], "30");
    editDraft(jinx);
    syncDeckDraft(queryClient, userA, deckId, [viktor, ahri], "44");
    resolveDeckDraftConflict(queryClient, userA, deckId, "load");

    editDraft(jinx);
    await vi.advanceTimersByTimeAsync(1000);

    expect(expectedVersionOfCall(0)).toBe("44");
  });

  it("keeps the version a save returned over an older one that came with its own cards", async () => {
    syncDeckDraft(queryClient, userA, deckId, [viktor], "30");
    storingSave("41");
    editDraft(jinx);
    await vi.advanceTimersByTimeAsync(1000);
    syncDeckDraft(queryClient, userA, deckId, [viktor, jinx], "30");

    editDraft(ahri);
    await vi.advanceTimersByTimeAsync(1000);

    expect(expectedVersionOfCall(1)).toBe("41");
  });

  it("names the version its last save stored on the next save", async () => {
    syncDeckDraft(queryClient, userA, deckId, [viktor]);
    storingSave("41");
    editDraft(jinx);
    await vi.advanceTimersByTimeAsync(1000);

    editDraft(ahri);
    await vi.advanceTimersByTimeAsync(1000);

    expect(expectedVersionOfCall(0)).toBeUndefined();
    expect(expectedVersionOfCall(1)).toBe("41");
  });

  it("holds a conflict when the server refuses a save over another device's change", async () => {
    syncDeckDraft(queryClient, userA, deckId, [viktor]);
    storingSave("41");
    editDraft(jinx);
    await vi.advanceTimersByTimeAsync(1000);

    refusedSave("57", [viktor, ahri]);
    getDeckDraftCollection(queryClient, userA, deckId).delete(`${jinx.cardId}|main|`);
    await vi.advanceTimersByTimeAsync(1000);
    syncDeckDraft(queryClient, userA, deckId, [viktor, ahri]);

    expect(saveDeckCardsSpy).toHaveBeenCalledTimes(2);
    expect(getDeckDraftHasConflict(queryClient, userA, deckId)).toBe(true);
    expect(getDeckDraftStatus(queryClient, userA, deckId)).toMatchObject({
      isDirty: true,
      error: null,
    });
    expect(draftCards()).toEqual(["viktorx3"]);

    resolveDeckDraftConflict(queryClient, userA, deckId, "keep");
    await vi.advanceTimersByTimeAsync(0);
    expect(expectedVersionOfCall(2)).toBe("57");
  });

  it("saves again when the refused save only met its own earlier write", async () => {
    syncDeckDraft(queryClient, userA, deckId, [viktor]);
    refusedSave("57", [viktor]);
    editDraft(jinx);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(0);

    expect(saveDeckCardsSpy).toHaveBeenCalledTimes(2);
    expect(expectedVersionOfCall(1)).toBe("57");
    expect(getDeckDraftHasConflict(queryClient, userA, deckId)).toBe(false);
  });

  it("lets a successful save replace a change that arrived while it was in flight", async () => {
    const save = deferredSave();
    syncDeckDraft(queryClient, userA, deckId, [viktor]);
    editDraft(jinx);
    await vi.advanceTimersByTimeAsync(1000);

    syncDeckDraft(queryClient, userA, deckId, [viktor, ahri]);
    save.settle();
    await vi.advanceTimersByTimeAsync(0);
    syncDeckDraft(queryClient, userA, deckId, [viktor, jinx]);

    expect(getDeckDraftHasConflict(queryClient, userA, deckId)).toBe(false);
    expect(draftCards()).toEqual(["jinxx2", "viktorx3"]);
  });

  it("keeps a card the catalog does not know through hydrate and save", async () => {
    const unknown = toDraftDeckCard(
      { cardId: "newer-set-card", zone: "main", quantity: 2, preferredPrintingId: null },
      {},
    );
    syncDeckDraft(queryClient, userA, deckId, [unknown, viktor]);
    editDraft(jinx);
    await vi.advanceTimersByTimeAsync(1000);

    expect(draftCards()).toEqual(["jinxx2", "newer-set-cardx2", "viktorx3"]);
    expect(saveDeckCardsSpy.mock.calls[0]?.[2]).toContainEqual({
      cardId: "newer-set-card",
      zone: "main",
      quantity: 2,
      preferredPrintingId: null,
    });
  });

  it("fills in an unknown card once the catalog knows it", async () => {
    const unknown = toDraftDeckCard(
      { cardId: "viktor", zone: "main", quantity: 3, preferredPrintingId: null },
      {},
    );
    syncDeckDraft(queryClient, userA, deckId, [unknown]);

    syncDeckDraft(queryClient, userA, deckId, [viktor]);
    await vi.advanceTimersByTimeAsync(1000);

    expect(getDeckDraftCollection(queryClient, userA, deckId).get("viktor|main|")?.cardName).toBe(
      "Test Card",
    );
    expect(saveDeckCardsSpy).not.toHaveBeenCalled();
  });

  it("leaves a browser-local deck's draft to the player", () => {
    const localId = createLocalDeck(WellKnown.deckFormat.CONSTRUCTED);
    syncDeckDraft(queryClient, "local", localId, [viktor]);

    syncDeckDraft(queryClient, "local", localId, [jinx]);

    expect(draftCards("local", localId)).toEqual(["viktorx3"]);
    expect(getDeckDraftHasConflict(queryClient, "local", localId)).toBe(false);
  });
});
