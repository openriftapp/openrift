import type { DeckCardWithDeckResponse } from "@openrift/shared/types/api/deck";
import type { Card } from "@openrift/shared/types/catalog";
import { WellKnown } from "@openrift/shared/well-known";
import { createCollection, localOnlyCollectionOptions } from "@tanstack/react-db";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

function cardRow(deckId: string, quantity: number): DeckCardWithDeckResponse {
  return {
    deckId,
    cardId: "card-1",
    zone: WellKnown.deckZone.MAIN,
    quantity,
    preferredPrintingId: null,
  };
}

function rowKey(row: DeckCardWithDeckResponse) {
  return `${row.deckId}:${row.cardId}:${row.zone}`;
}

const cardsCollection = createCollection(
  localOnlyCollectionOptions<DeckCardWithDeckResponse>({
    id: "deck-cards:rail-test",
    getKey: rowKey,
  }),
);

vi.mock("@/features/decks/hooks/use-decks-collections", () => ({
  useDeckCardsCollection: () => cardsCollection,
}));

vi.mock("@/features/cards/hooks/use-cards", async () => {
  const { stubCard } = await import("@/test/factories");
  const cardsById: Record<string, Card> = { "card-1": stubCard({ slug: "card-1", name: "Yasuo" }) };
  return { useCards: () => ({ cardsById }) };
});

vi.mock("@/features/decks/hooks/use-decks", () => ({
  useDecks: () => ({
    data: [
      {
        deck: {
          id: "deck-a",
          name: "Yasuo Aggro",
          familyId: "family-1",
          predecessorDeckId: null,
          isDraft: false,
          updatedAt: "2026-08-01T00:00:00.000Z",
        },
      },
      {
        deck: {
          id: "deck-b",
          name: "Yasuo Aggro (v2)",
          familyId: "family-1",
          predecessorDeckId: "deck-a",
          isDraft: false,
          updatedAt: "2026-08-02T00:00:00.000Z",
        },
      },
    ],
  }),
}));

// Both dialogs render closed here and drag in the whole deck-editing surface.
vi.mock("./deck-variant-create-dialog", () => ({ DeckVariantCreateDialog: () => null }));
vi.mock("./deck-variants-dialog", () => ({ DeckVariantsDialog: () => null }));

const { DeckVariantRail } = await import("./deck-variant-rail");

describe("DeckVariantRail", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    const existing = cardsCollection.toArray;
    if (existing.length > 0) {
      cardsCollection.delete(existing.map((row) => rowKey(row)));
    }
    cardsCollection.insert([
      cardRow("deck-a", 3),
      cardRow("deck-b", 3),
      // A deck outside the family: its rows must never reach the rail's diff.
      cardRow("deck-outsider", 7),
    ]);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  function renderRail() {
    return render(
      <QueryClientProvider client={queryClient}>
        <DeckVariantRail deckId="deck-b" />
      </QueryClientProvider>,
    );
  }

  it("draws the step diff between two family members", async () => {
    renderRail();
    expect(await screen.findByText("−0")).toBeInTheDocument();
    expect(screen.getByText("+0")).toBeInTheDocument();
  });

  it("follows later edits to the open deck's cards", async () => {
    renderRail();
    await screen.findByText("−0");

    act(() => {
      cardsCollection.update(rowKey(cardRow("deck-b", 3)), (draft) => {
        draft.quantity = 1;
      });
    });

    expect(await screen.findByText("−2")).toBeInTheDocument();
    expect(screen.getByText("+0")).toBeInTheDocument();
  });

  it("ignores edits to a deck outside the rail", async () => {
    renderRail();
    await screen.findByText("−0");

    act(() => {
      cardsCollection.update(rowKey(cardRow("deck-outsider", 7)), (draft) => {
        draft.quantity = 1;
      });
    });

    expect(await screen.findByText("−0")).toBeInTheDocument();
    expect(screen.getByText("+0")).toBeInTheDocument();
  });
});
