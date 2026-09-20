import type {
  DeckCardWithDeckResponse,
  DeckListItemResponse,
} from "@openrift/shared/types/api/deck";
import type { Card } from "@openrift/shared/types/catalog";
import { WellKnown } from "@openrift/shared/well-known";
import { createCollection, localOnlyCollectionOptions } from "@tanstack/react-db";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";

const { dialogProps } = vi.hoisted(() => ({
  dialogProps: {} as Record<string, Record<string, unknown>>,
}));

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

const cardsCollection = createCollection(
  localOnlyCollectionOptions<DeckCardWithDeckResponse>({
    id: "deck-cards:actions-menu-test",
    getKey: rowKey,
  }),
);

vi.mock("@/features/decks/hooks/use-decks-collections", () => ({
  useDeckCardsCollection: () => cardsCollection,
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
vi.mock("@/features/decks/hooks/use-decks", () => ({
  useDeleteDeck: () => noopMutation,
  usePromoteDeckPrimary: () => noopMutation,
  useSetDeckArchived: () => noopMutation,
  useSetDeckPinned: () => noopMutation,
  useUpdateDeck: () => noopMutation,
}));

vi.mock("@/features/decks/hooks/use-deck-folders", () => ({
  useDeckFolders: () => ({ data: [] }),
  useSetDeckFolders: () => noopMutation,
}));

vi.mock("@/hooks/use-enums", () => ({ useDeckFormatList: () => ({ formats: [] }) }));

vi.mock("@/features/cards/hooks/use-cards", async () => {
  const { stubCard } = await import("@/test/factories");
  const cardsById: Record<string, Card> = {
    "card-own": stubCard({ slug: "card-own", name: "Yasuo" }),
    "card-other": stubCard({ slug: "card-other", name: "Ahri" }),
  };
  return { useCards: () => ({ cardsById }) };
});

// The dialogs stand in as prop recorders: what matters here is which cards reach them.
vi.mock("./deck-export-dialog", () => ({
  DeckExportDialog: (props: Record<string, unknown>) => {
    dialogProps.export = props;
    return null;
  },
}));
vi.mock("./deck-print-dialog", () => ({
  DeckPrintDialog: (props: Record<string, unknown>) => {
    dialogProps.print = props;
    return null;
  },
}));
vi.mock("./deck-share-dialog", () => ({
  DeckShareDialog: (props: Record<string, unknown>) => {
    dialogProps.share = props;
    return null;
  },
}));
vi.mock("./deck-rename-dialog", () => ({ DeckRenameDialog: () => null }));
vi.mock("./deck-variants-dialog", () => ({ DeckVariantsDialog: () => null }));
vi.mock("./manage-deck-folders-dialog", () => ({ ManageDeckFoldersDialog: () => null }));

const { DeckActionsMenu } = await import("./deck-actions-menu");

const ITEM = {
  deck: {
    id: "deck-own",
    name: "Yasuo Aggro",
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
} satisfies DeckListItemResponse;

describe("DeckActionsMenu", () => {
  beforeEach(() => {
    const existing = cardsCollection.toArray;
    if (existing.length > 0) {
      cardsCollection.delete(existing.map((row) => rowKey(row)));
    }
    cardsCollection.insert([
      cardRow("deck-own", "card-own", 3),
      cardRow("deck-other", "card-other", 2),
    ]);
    dialogProps.export = {};
  });

  it("reads no cards until a dialog that needs them opens", () => {
    render(<DeckActionsMenu item={ITEM} />);

    expect(dialogProps.export?.cards).toBeUndefined();
  });

  it("hands the export dialog this deck's cards and no other deck's", async () => {
    const user = userEvent.setup();
    render(<DeckActionsMenu item={ITEM} />);

    await user.click(screen.getByRole("button", { name: "Deck actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Export…" }));

    await vi.waitFor(() => {
      expect(dialogProps.export?.cards).toBeDefined();
    });
    const cards = dialogProps.export?.cards as DeckBuilderCard[];
    expect(cards.map((card) => [card.cardId, card.quantity])).toEqual([["card-own", 3]]);
  });
});
