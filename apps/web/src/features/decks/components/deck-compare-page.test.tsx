import type {
  DeckCardWithDeckResponse,
  DeckListItemResponse,
} from "@openrift/shared/types/api/deck";
import type { Card } from "@openrift/shared/types/catalog";
import { WellKnown } from "@openrift/shared/well-known";
import { createCollection, localOnlyCollectionOptions } from "@tanstack/react-db";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

function cardRow(deckId: string, cardId: string, quantity: number): DeckCardWithDeckResponse {
  return {
    deckId,
    cardId,
    zone: WellKnown.deckZone.MAIN,
    quantity,
    preferredPrintingId: null,
  };
}

function rowKey(row: DeckCardWithDeckResponse) {
  return `${row.deckId}:${row.cardId}:${row.zone}`;
}

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
    totalCards: 3,
    typeCounts: [],
    domainDistribution: [],
    isValid: true,
    requiredProgress: 3,
    requiredTotal: 3,
    totalValueCents: null,
    missingCount: null,
    folderIds: [],
  };
}

const cardsCollection = createCollection(
  localOnlyCollectionOptions<DeckCardWithDeckResponse>({
    id: "deck-cards:compare-test",
    getKey: rowKey,
  }),
);

const decksCollection = createCollection(
  localOnlyCollectionOptions<DeckListItemResponse>({
    id: "decks:compare-test",
    getKey: (row) => row.deck.id,
  }),
);

vi.mock("@/features/decks/hooks/use-decks-collections", () => ({
  useDeckCardsCollection: () => cardsCollection,
  useDecksCollection: () => decksCollection,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/decks">{children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock("@/components/layout/page-top-bar", () => ({
  PageTopBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageTopBarActions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageTopBarBack: () => null,
  PageTopBarSticky: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageTopBarTitle: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
}));

vi.mock("@/features/cards/components/card-mini-row", () => ({ CardMiniRow: () => null }));
vi.mock("./deck-mini-identity", () => ({ DeckMiniIdentity: () => null }));
vi.mock("./deck-compare-paste-dialog", () => ({ DeckComparePasteDialog: () => null }));
vi.mock("./hovered-card-preview", () => ({ HoveredCardPreview: () => null }));

vi.mock("@/features/cards/hooks/use-cards", async () => {
  const { stubCard } = await import("@/test/factories");
  const cardsById: Record<string, Card> = {
    "card-1": stubCard({ slug: "card-1", name: "Yasuo" }),
    "card-2": stubCard({ slug: "card-2", name: "Ahri" }),
    "card-3": stubCard({ slug: "card-3", name: "Braum" }),
  };
  return { useCards: () => ({ cardsById }) };
});
vi.mock("@/features/cards/hooks/use-preferred-printing", () => ({
  usePreferredPrinting: () => ({ getPreferredPrinting: () => undefined }),
}));
vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ labels: { rarities: {}, domains: {} } }),
}));
vi.mock("@/hooks/use-domain-colors", () => ({ useDomainColors: () => ({}) }));
vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/features/decks/hooks/use-local-decks", () => ({
  useLocalDeck: () => undefined,
  useLocalDecks: () => [],
}));

const { DeckComparePage } = await import("./deck-compare-page");

describe("DeckComparePage", () => {
  beforeEach(() => {
    const rows = cardsCollection.toArray;
    if (rows.length > 0) {
      cardsCollection.delete(rows.map((row) => rowKey(row)));
    }
    const decks = decksCollection.toArray;
    if (decks.length > 0) {
      decksCollection.delete(decks.map((row) => row.deck.id));
    }
    decksCollection.insert([
      deckRow("deck-a", "Rift Rush"),
      deckRow("deck-b", "Rift Guard"),
      deckRow("deck-c", "Stone Wall"),
    ]);
    cardsCollection.insert([
      cardRow("deck-a", "card-1", 3),
      cardRow("deck-b", "card-1", 2),
      cardRow("deck-b", "card-2", 1),
      cardRow("deck-c", "card-3", 4),
    ]);
  });

  it("diffs only the two chosen decks' rows", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <DeckComparePage fromId="deck-a" toId="deck-b" />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("2 cards are the same")).toBeInTheDocument();
    // The changed card sits on both sides of its row; the added one only on the right.
    expect(screen.getAllByText("Yasuo")).toHaveLength(2);
    expect(screen.getByText("Ahri")).toBeInTheDocument();
    expect(screen.queryByText("Braum")).toBeNull();
  });
});
