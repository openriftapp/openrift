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

const { dialogProps, boxed, navigate, router, mobile } = vi.hoisted(() => ({
  mobile: { current: false },
  navigate: vi.fn(),
  router: { preloadRoute: vi.fn((_options: unknown) => Promise.resolve(undefined)) },
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

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to: _to,
    search: _search,
    params: _params,
    children,
    ...rest
  }: {
    to: string;
    search?: unknown;
    params?: unknown;
    children?: React.ReactNode;
  }) => (
    <a href="/decks/compare" {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => navigate,
  useRouter: () => router,
}));
vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => mobile.current }));
vi.mock("@/features/decks/hooks/use-boxed-decks", () => ({ useBoxedDecks: () => boxed.current }));

const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
const exportMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(() => Promise.resolve({ code: "CODE", warnings: [] })),
  isPending: false,
};
vi.mock("@/features/decks/hooks/use-decks", async (importOriginal) => ({
  ...(await importOriginal<typeof UseDecks>()),
  useDeleteDeck: () => noopMutation,
  usePromoteDeckPrimary: () => noopMutation,
  useSetDeckArchived: () => noopMutation,
  useSetDeckPinned: () => noopMutation,
  useUpdateDeck: () => noopMutation,
  useCloneDeck: () => noopMutation,
  useUpdateDeckMeta: () => ({ update: vi.fn(), isPending: false }),
  useExportDeck: () => exportMutation,
  useEncodeDeckCards: () => noopMutation,
}));
vi.mock("@/hooks/use-copy-to-clipboard", () => ({
  copyPendingText: () => Promise.resolve(true),
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
vi.mock("./deck-print-dialog", () => ({
  DeckPrintDialog: (props: Record<string, unknown>) => {
    dialogProps.print = props;
    return null;
  },
}));
vi.mock("./deck-share-dialog", () => ({
  DeckShareDialog: () => null,
  DeckImageDialog: () => null,
}));
vi.mock("./deck-home-collection-dialog", () => ({
  DeckHomeCollectionDialog: (props: Record<string, unknown>) => {
    dialogProps.storedIn = props;
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
  lockedCount: null,
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
    mobile.current = false;
    dialogProps.print = {};
    dialogProps.storedIn = {};
    boxed.current = [];
  });

  it("shows the deck's own box beside Stored in…", async () => {
    boxed.current = [
      { deckId: "deck-own", deckName: "Yasuo Aggro", boxName: "Red box", collectionId: "c1" },
    ];
    const user = userEvent.setup();
    render(<DeckActionsMenu item={ITEM} source="server" />);

    await user.click(screen.getByRole("button", { name: "Deck actions" }));
    expect(await screen.findByRole("menuitem", { name: /Stored in…/u })).toHaveTextContent(
      "Red box",
    );
  });

  it("hands the Stored in dialog each boxed variant of a family front", async () => {
    boxed.current = [
      { deckId: "v2", deckName: "Yasuo VEN", boxName: "Red box", collectionId: "c1" },
      { deckId: "v3", deckName: "Yasuo UNL", boxName: "Blue box", collectionId: "c2" },
    ];
    const user = userEvent.setup();
    render(<DeckActionsMenu item={ITEM} source="server" />);

    await user.click(screen.getByRole("button", { name: "Deck actions" }));
    await user.click(await screen.findByRole("menuitem", { name: /Stored in…/u }));

    expect(dialogProps.storedIn?.stored).toEqual(boxed.current);
  });

  it("reads no cards until a dialog that needs them opens", () => {
    render(<DeckActionsMenu item={ITEM} source="server" />);

    expect(dialogProps.print?.cards).toBeUndefined();
  });

  it("hands the proxy print dialog this deck's cards and no other deck's", async () => {
    const user = userEvent.setup();
    render(<DeckActionsMenu item={ITEM} source="server" />);

    await user.click(screen.getByRole("button", { name: "Deck actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Proxies…" }));

    await vi.waitFor(() => {
      expect(dialogProps.print?.cards).toBeDefined();
    });
    expect(dialogProps.print?.kind).toBe("proxies");
    const cards = dialogProps.print?.cards as DeckBuilderCard[];
    expect(cards.map((card) => [card.cardId, card.quantity])).toEqual([["card-own", 3]]);
  });

  it("prints a card this client's catalog does not know", async () => {
    cardsCollection.insert(cardRow("deck-own", "card-gone", 2));
    const user = userEvent.setup();
    render(<DeckActionsMenu item={ITEM} source="server" />);

    await user.click(screen.getByRole("button", { name: "Deck actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Registration sheet…" }));

    await vi.waitFor(() => {
      expect(dialogProps.print?.cards).toBeDefined();
    });
    const cards = dialogProps.print?.cards as DeckBuilderCard[];
    expect(cards.map((card) => [card.cardId, card.quantity])).toEqual(
      expect.arrayContaining([
        ["card-own", 3],
        ["card-gone", 2],
      ]),
    );
    expect(cards).toHaveLength(2);
  });

  it("copies a saved deck's code by exporting it by id", async () => {
    const user = userEvent.setup();
    exportMutation.mutateAsync.mockClear();
    render(<DeckActionsMenu item={ITEM} source="server" />);

    await user.click(screen.getByRole("button", { name: "Deck actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Deck code" }));

    expect(exportMutation.mutateAsync).toHaveBeenCalledWith({
      deckId: "deck-own",
      format: "piltover",
    });
  });

  it("puts Unarchive beside Delete on an archived deck", async () => {
    const user = userEvent.setup();
    noopMutation.mutate.mockClear();
    render(
      <DeckActionsMenu
        item={{ ...ITEM, deck: { ...ITEM.deck, archivedAt: "2026-10-01T00:00:00.000Z" } }}
        source="server"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Deck actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Unarchive" }));
    expect(noopMutation.mutate).toHaveBeenCalledWith({ deckId: "deck-own", archived: false });
  });

  it("disables the outputs of a deck with no cards", async () => {
    const user = userEvent.setup();
    render(<DeckActionsMenu item={{ ...ITEM, totalCards: 0 }} source="server" />);

    await user.click(screen.getByRole("button", { name: "Deck actions" }));
    for (const name of ["Text list", "Deck code", "Proxies…", "Present"]) {
      expect(await screen.findByRole("menuitem", { name })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    }
    expect(screen.getByRole("menuitem", { name: /Compare/u })).not.toHaveAttribute("aria-disabled");
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

  it("offers duplicate on a server deck", async () => {
    const user = userEvent.setup();
    noopMutation.mutate.mockClear();
    render(<DeckActionsMenu item={ITEM} source="server" />);

    await user.click(screen.getByRole("button", { name: "Deck actions" }));
    const copies = await screen.findByRole("menuitem", { name: "Copies & variants" });
    copies.focus();
    await user.keyboard("{ArrowRight}");
    await user.click(await screen.findByRole("menuitem", { name: "Duplicate" }));
    expect(noopMutation.mutate).toHaveBeenCalledWith("deck-own", expect.anything());
  });

  it("preloads the show page when the menu opens, so Present works offline", async () => {
    const user = userEvent.setup();
    router.preloadRoute.mockClear();
    render(<DeckActionsMenu item={ITEM} source="server" />);

    expect(router.preloadRoute).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Deck actions" }));
    await screen.findByRole("menuitem", { name: "Present" });
    expect(router.preloadRoute).toHaveBeenCalledWith({
      to: "/stage/show",
      search: { deck: "deck-own", i: 0 },
    });
    expect(router.preloadRoute).toHaveBeenCalledWith({
      to: "/decks/$deckId",
      params: { deckId: "deck-own" },
    });
  });

  it("presents the deck on the show page", async () => {
    const user = userEvent.setup();
    navigate.mockClear();
    render(<DeckActionsMenu item={ITEM} source="server" />);

    await user.click(screen.getByRole("button", { name: "Deck actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Present" }));
    expect(navigate).toHaveBeenCalledWith({
      to: "/stage/show",
      search: { deck: "deck-own", i: 0 },
    });
  });

  it("opens Manage submenus in place on a phone and returns focus to their trigger", async () => {
    mobile.current = true;
    const user = userEvent.setup();
    render(<DeckActionsMenu item={ITEM} source="server" />);

    await user.click(screen.getByRole("button", { name: "Deck actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Edit deck" }));
    expect(screen.getByRole("menuitem", { name: "Name & description" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Text list" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Change format" }));
    expect(screen.getByRole("menuitem", { name: "Freeform" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Back" }));
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Change format" })).toHaveFocus();
    });

    await user.click(screen.getByRole("menuitem", { name: "Back" }));
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Edit deck" })).toHaveFocus();
    });
    expect(screen.getByRole("menuitem", { name: "Text list" })).toBeInTheDocument();
  });
});
