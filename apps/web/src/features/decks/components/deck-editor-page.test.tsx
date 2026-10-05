import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const flushDeckDraft = vi.hoisted(() => vi.fn());

vi.mock("@/features/decks/stores/deck-draft-store", () => ({
  flushDeckDraft,
  hydrateDeckDraft: vi.fn(),
}));
vi.mock("@/features/decks/hooks/use-deck-draft", () => ({
  useDeckDraftHydrated: () => false,
  useDeckSaveStatus: () => ({ isDirty: false, isSaving: false }),
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
vi.mock("@/features/decks/hooks/use-deck-editor-dialogs", () => ({
  useDeckEditorDialogs: () => ({ openDialog: vi.fn() }),
}));
vi.mock("@/features/decks/components/deck-undo-controls", () => ({
  useDeckUndoShortcuts: () => {},
}));
vi.mock("@/features/cards/hooks/use-card-filters", () => ({
  useFilterActions: () => ({ setArrayFilters: vi.fn(), setRanges: vi.fn(), setSearch: vi.fn() }),
}));
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
vi.mock("@/hooks/use-command-palette", () => ({ useRegisterQuickAdd: () => {} }));
vi.mock("@/hooks/use-header-height", () => ({ useHeaderHeight: () => 0 }));
vi.mock("@/hooks/use-measured-height", () => ({ useMeasuredHeight: () => 0 }));
vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ data: null }),
  useUserId: () => "user-1",
}));
vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => children,
  useSidebar: () => ({ isMobile: false, setOpenMobile: vi.fn(), toggleSidebar: vi.fn() }),
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { DeckEditorPage } from "./deck-editor-page";

function renderPage(deckId: string) {
  const queryClient = new QueryClient();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <DeckEditorPage deckId={deckId} />
    </QueryClientProvider>,
  );
  return { queryClient, ...view };
}

beforeEach(() => {
  flushDeckDraft.mockClear();
});

describe("DeckEditorPage", () => {
  it("flushes the pending save for the deck when it unmounts", () => {
    const { queryClient, unmount } = renderPage("deck-1");
    expect(flushDeckDraft).not.toHaveBeenCalled();

    unmount();

    expect(flushDeckDraft).toHaveBeenCalledWith(queryClient, "user-1", "deck-1");
  });
});
