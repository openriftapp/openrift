import type { DeckListItemResponse } from "@openrift/shared/types/api/deck";
import { WellKnown } from "@openrift/shared/well-known";
import { createCollection, localOnlyCollectionOptions } from "@tanstack/react-db";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const search = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("@tanstack/react-router", () => ({
  getRouteApi: () => ({ useSearch: () => search.current }),
  useNavigate: () => vi.fn(),
}));

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      // oxlint-disable-next-line react/function-component-definition -- mocked server-fn handler, not a component
      handler: () => async () => null,
      middleware: () => chain,
      validator: () => chain,
    };
    return chain;
  },
  createMiddleware: () => {
    const chain = { server: () => chain };
    return chain;
  },
}));

const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
vi.mock("@/features/decks/hooks/use-decks", () => ({
  useCreateDeck: () => noopMutation,
  useSaveDeckCards: () => noopMutation,
}));
vi.mock("@/features/decks/hooks/use-local-decks", () => ({ useLocalDecks: () => [] }));
vi.mock("@/features/cards/hooks/use-cards", () => ({ useCards: () => ({ allPrintings: [] }) }));
vi.mock("@/hooks/use-enums", () => ({
  useDeckFormatList: () => ({ formats: [], labels: {} }),
  useZoneOrder: () => ({ zoneOrder: [], zoneLabels: {} }),
}));
vi.mock("@/lib/auth-session", () => ({ useUserId: () => "user-1" }));

function deckRow(id: string, name: string): DeckListItemResponse {
  return {
    deck: {
      id,
      name,
      descriptionSnippet: null,
      description: null,
      links: [],
      oddsConfig: null,
      isPublic: false,
      shareToken: null,
      format: WellKnown.deckFormat.CONSTRUCTED,
      formatConfig: null,
      isPinned: false,
      archivedAt: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      coverCardId: null,
      coverPrintingId: null,
      coverPosition: null,
      collectionId: null,
      familyId: null,
      predecessorDeckId: null,
      isPrimary: false,
      isDraft: false,
    },
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
  };
}

const decksCollection = createCollection(
  localOnlyCollectionOptions<DeckListItemResponse>({
    id: "decks:import-flow-test",
    getKey: (row) => row.deck.id,
  }),
);

vi.mock("@/features/decks/hooks/use-decks-collections", () => ({
  useDecksCollection: () => decksCollection,
}));

const { useDeckImportFlow } = await import("./use-deck-import-flow");

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useDeckImportFlow", () => {
  beforeEach(() => {
    const existing = decksCollection.toArray;
    if (existing.length > 0) {
      decksCollection.delete(existing.map((row) => row.deck.id));
    }
    decksCollection.insert([deckRow("deck-a", "Yasuo Aggro"), deckRow("deck-b", "Ahri Tempo")]);
    search.current = {};
  });

  it("names the replace target and no other deck", async () => {
    search.current = { replaceDeckId: "deck-b" };

    const { result } = renderHook(() => useDeckImportFlow(), { wrapper });

    await waitFor(() => expect(result.current.replaceDeckName).toBe("Ahri Tempo"));
    expect(result.current.isReplaceMode).toBe(true);
  });

  it("has no replace target without a replace id", () => {
    const { result } = renderHook(() => useDeckImportFlow(), { wrapper });

    expect(result.current.isReplaceMode).toBe(false);
    expect(result.current.replaceDeckName).toBeUndefined();
  });

  it("leaves the name undefined for an id the store has no deck for", async () => {
    search.current = { replaceDeckId: "deck-missing" };

    const { result } = renderHook(() => useDeckImportFlow(), { wrapper });

    await waitFor(() => expect(result.current.isReplaceMode).toBe(true));
    expect(result.current.replaceDeckName).toBeUndefined();
  });
});
