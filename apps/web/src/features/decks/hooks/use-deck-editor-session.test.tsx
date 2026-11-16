import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  flushDeckDraft: vi.fn(),
  syncDeckDraft: vi.fn(),
  refetchDeckCards: vi.fn(() => Promise.resolve()),
  registerQuickAdd: vi.fn(),
  hydrated: false,
  saveStatus: { isDirty: false, isSaving: false },
}));

vi.mock("@/features/decks/stores/deck-draft-store", () => ({
  flushDeckDraft: mocks.flushDeckDraft,
  syncDeckDraft: mocks.syncDeckDraft,
  getDeckDraftHydrated: () => mocks.hydrated,
}));
vi.mock("@/features/decks/lib/decks-collection", () => ({
  getDeckCardsCollection: () => ({ utils: { refetch: mocks.refetchDeckCards } }),
}));
vi.mock("@/features/decks/hooks/use-deck-draft", () => ({
  useDeckDraftHydrated: () => mocks.hydrated,
  useDeckSaveStatus: () => mocks.saveStatus,
}));
vi.mock("@/features/decks/hooks/use-decks", () => ({
  useDeckDetail: () => ({
    data: { deck: { format: "constructed", formatConfig: null, collectionId: null }, cards: [] },
  }),
}));
vi.mock("@/features/decks/hooks/use-local-decks", () => ({ useIsLocalDeck: () => false }));
vi.mock("@/features/decks/hooks/use-deck-builder", () => ({
  useDeckCards: () => [],
  useDeckViolations: () => [],
}));
vi.mock("@/features/decks/hooks/use-deck-items", () => ({
  useDeckItems: () => ({ items: [], printingsByCardId: new Map() }),
}));
vi.mock("@/features/decks/hooks/use-deck-ownership", () => ({ useDeckOwnership: () => ({}) }));
vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({ cardsById: new Map(), allPrintings: [] }),
}));
vi.mock("@/features/cards/hooks/use-preferred-printing", () => ({
  usePreferredPrinting: () => ({ getPreferredPrinting: () => undefined }),
}));
vi.mock("@/features/collections/hooks/use-owned-count", () => ({
  useDeckBuildingCounts: () => ({ data: undefined }),
}));
vi.mock("@/features/groups/hooks/use-card-trades", () => ({
  useIncomingTradeCounts: () => ({ data: undefined }),
}));
vi.mock("@/features/groups/hooks/use-loans", () => ({
  useBorrowedCounts: () => ({ data: undefined }),
}));
vi.mock("@/hooks/use-command-palette", () => ({ useRegisterQuickAdd: mocks.registerQuickAdd }));
vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ data: null }),
  useUserId: () => "user-1",
}));

import { useDeckEditorSession } from "./use-deck-editor-session";

function renderSession(deckId = "deck-1") {
  const queryClient = new QueryClient();
  return renderHook(() => useDeckEditorSession(deckId), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

function beforeUnloadPrevented(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  globalThis.dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(() => {
  mocks.hydrated = false;
  mocks.saveStatus = { isDirty: false, isSaving: false };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useDeckEditorSession", () => {
  it("syncs the draft with the stored cards under the user's scope", () => {
    renderSession();
    expect(mocks.syncDeckDraft).toHaveBeenCalledWith(expect.anything(), "user-1", "deck-1", []);
  });

  it("syncs an already hydrated draft so a re-entered editor sees changes made elsewhere", () => {
    mocks.hydrated = true;
    renderSession();
    expect(mocks.syncDeckDraft).toHaveBeenCalledWith(expect.anything(), "user-1", "deck-1", []);
  });

  it("rereads the stored cards when a draft from an earlier visit is reopened", () => {
    mocks.hydrated = true;
    renderSession();
    expect(mocks.refetchDeckCards).toHaveBeenCalledOnce();
  });

  it("does not reread the stored cards on a first visit", () => {
    renderSession();
    expect(mocks.refetchDeckCards).not.toHaveBeenCalled();
  });

  it("registers the deck's quick add", () => {
    renderSession();
    expect(mocks.registerQuickAdd).toHaveBeenCalledWith(
      expect.objectContaining({ key: "deck:deck-1" }),
    );
  });

  it("warns before leaving only while the draft is unsaved", () => {
    const view = renderSession();
    expect(beforeUnloadPrevented()).toBe(false);
    mocks.saveStatus = { isDirty: true, isSaving: false };
    view.rerender();
    expect(beforeUnloadPrevented()).toBe(true);
    view.unmount();
    expect(beforeUnloadPrevented()).toBe(false);
  });

  it("flushes the draft when the editor unmounts", () => {
    const view = renderSession();
    expect(mocks.flushDeckDraft).not.toHaveBeenCalled();
    view.unmount();
    expect(mocks.flushDeckDraft).toHaveBeenCalledWith(expect.anything(), "user-1", "deck-1");
  });
});
