// @vitest-environment happy-dom
import { WellKnown } from "@openrift/shared/well-known";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createEmptyPlanDraft } from "@/features/decks/lib/deck-plan";
import {
  createLocalDeck,
  getLocalDecksCollection,
  preloadLocalDecks,
} from "@/features/decks/lib/local-decks-collection";
import { resetIdCounter, stubDeckBuilderCard } from "@/test/factories";

import {
  flushDeckDraft,
  getDeckDraftCollection,
  getDeckDraftHydrated,
  getDeckDraftStatus,
  getDeckPlanDraft,
  hydrateDeckDraft,
  resetDeckDraft,
  setDeckPlanDraft,
} from "./deck-draft-store";

await preloadLocalDecks();

function clearLocalDecks() {
  const rows = getLocalDecksCollection().toArray;
  if (rows.length > 0) {
    getLocalDecksCollection().delete(rows.map((deck) => deck.id));
  }
}

// `vi.hoisted` keeps the spy available to the hoisted `vi.mock` factory below.
const { saveDeckCardsSpy } = vi.hoisted(() => ({
  saveDeckCardsSpy: vi.fn((..._args: unknown[]) => ({
    isPersisted: { promise: Promise.resolve() },
  })),
}));
vi.mock("@/features/decks/lib/decks-write", () => ({
  saveDeckCards: (...args: unknown[]) => saveDeckCardsSpy(...args),
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
      // oxlint-disable-next-line promise/avoid-new -- a save that never settles, so the reset's abort is what ends it
      isPersisted: { promise: new Promise<void>(() => {}) },
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
