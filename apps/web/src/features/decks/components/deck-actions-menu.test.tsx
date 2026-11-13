import type {
  DeckCardWithDeckResponse,
  DeckListItemResponse,
} from "@openrift/shared/types/api/deck";
import type { Card } from "@openrift/shared/types/catalog";
import { WellKnown } from "@openrift/shared/well-known";
import { createCollection, localOnlyCollectionOptions } from "@tanstack/react-db";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as UseDecks from "@/features/decks/hooks/use-decks";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";

const { dialogProps, boxed } = vi.hoisted(() => ({
  dialogProps: {} as Record<string, Record<string, unknown>>,
  boxed: {
    current: [] as { deckId: string; deckName: string; boxName: string; collectionId: string }[],
  },
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
vi.mock("@/features/decks/hooks/use-boxed-decks", () => ({ useBoxedDecks: () => boxed.current }));

const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
vi.mock("@/features/decks/hooks/use-decks", async (importOriginal) => ({
  ...(await importOriginal<typeof UseDecks>()),
  useDeleteDeck: () => noopMutation,
  usePromoteDeckPrimary: () => noopMutation,
  useSetDeckArchived: () => noopMutation,
  useSetDeckPinned: () => noopMutation,
  useUpdateDeck: () => noopMutation,
  useCloneDeck: () => noopMutation,
  useUpdateDeckMeta: () => ({ update: vi.fn(), isPending: false }),
}));

vi.mock("@/features/decks/hooks/use-local-decks", () => ({
  useLocalDeck: () => ({ cards: [] }),
  useIsLocalDeck: () => false,
}));

vi.mock("@/features/decks/hooks/use-deck-folders", () => ({
  useDeckFolders: () => ({ data: [] }),
  useSetDeckFolders: () => noopMutation,
}));

vi.mock("@/hooks/use-enums", () => ({
  useDeckFormatList: () => ({
    formats: [
      { slug: "constructed", label: "Constructed" },
      { slug: "freeform", label: "Freeform" },
    ],
  }),
}));

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
    coverFaceId: null,
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
  unpricedCardCount: null,
  missingCount: null,
  folderIds: [],
  familyName: null,
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
    boxed.current = [];
  });

  it("names the deck's own box", async () => {
    boxed.current = [
      { deckId: "deck-own", deckName: "Yasuo Aggro", boxName: "Red box", collectionId: "c1" },
    ];
    const user = userEvent.setup();
    render(<DeckActionsMenu item={ITEM} source="server" />);

    await user.click(screen.getByRole("button", { name: "Deck actions" }));
    expect(await screen.findByRole("menuitem", { name: "Stored in Red box" })).toBeInTheDocument();
  });

  it("names each boxed variant on a family front", async () => {
    boxed.current = [
      { deckId: "v2", deckName: "Yasuo VEN", boxName: "Red box", collectionId: "c1" },
      { deckId: "v3", deckName: "Yasuo UNL", boxName: "Blue box", collectionId: "c2" },
    ];
    const user = userEvent.setup();
    render(<DeckActionsMenu item={ITEM} source="server" />);

    await user.click(screen.getByRole("button", { name: "Deck actions" }));
    expect(
      await screen.findByRole("menuitem", { name: "Yasuo VEN in Red box" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Yasuo UNL in Blue box" })).toBeInTheDocument();
  });

  it("reads no cards until a dialog that needs them opens", () => {
    render(<DeckActionsMenu item={ITEM} source="server" />);

    expect(dialogProps.export?.cards).toBeUndefined();
  });

  it("hands the export dialog this deck's cards and no other deck's", async () => {
    const user = userEvent.setup();
    render(<DeckActionsMenu item={ITEM} source="server" />);

    await user.click(screen.getByRole("button", { name: "Deck actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Export…" }));

    await vi.waitFor(() => {
      expect(dialogProps.export?.cards).toBeDefined();
    });
    const cards = dialogProps.export?.cards as DeckBuilderCard[];
    expect(cards.map((card) => [card.cardId, card.quantity])).toEqual([["card-own", 3]]);
  });

  it("keeps the delete confirmation open until the delete succeeds", async () => {
    const user = userEvent.setup();
    noopMutation.mutate.mockClear();
    render(<DeckActionsMenu item={ITEM} source="server" />);

    await user.click(screen.getByRole("button", { name: "Deck actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(noopMutation.mutate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    const [, options] = noopMutation.mutate.mock.calls[0] as [string, { onSuccess: () => void }];
    act(() => options.onSuccess());
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });

  it("offers duplicate and change format on a browser-local deck, without account actions", async () => {
    const user = userEvent.setup();
    render(<DeckActionsMenu item={ITEM} source="local" />);

    await user.click(screen.getByRole("button", { name: "Deck actions" }));
    expect(await screen.findByRole("menuitem", { name: "Duplicate" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Pin" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Archive" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Change format" })).toBeInTheDocument();
  });

  it("offers duplicate on a server deck", async () => {
    const user = userEvent.setup();
    noopMutation.mutate.mockClear();
    render(<DeckActionsMenu item={ITEM} source="server" />);

    await user.click(screen.getByRole("button", { name: "Deck actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Duplicate" }));
    expect(noopMutation.mutate).toHaveBeenCalledWith("deck-own", expect.anything());
  });
});
