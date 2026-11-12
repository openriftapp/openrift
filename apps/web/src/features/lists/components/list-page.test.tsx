import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EMPTY_TRADE_PREFERENCE, stubPrinting } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

const printingOnList = stubPrinting({ printingId: "printing-1", cardId: "card-1" });
const printingOffList = stubPrinting({ printingId: "printing-2", cardId: "card-1" });

const cardKindListDetail = {
  list: {
    id: "list-1",
    name: "My wishlist",
    kind: "card",
    intent: "wish",
    rules: [] as { id: string }[],
    tradeDefaults: EMPTY_TRADE_PREFERENCE,
    currency: null,
    shareToken: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  entries: [
    {
      id: "entry-1",
      kind: "card",
      cardId: "card-1",
      cardName: "Test Card",
      quantity: 1,
      tradeOverride: EMPTY_TRADE_PREFERENCE,
    },
  ],
};

const printingKindListDetail = {
  list: { ...cardKindListDetail.list, kind: "printing" },
  entries: [
    {
      id: "entry-1",
      kind: "printing",
      printingId: printingOnList.printingId,
      cardId: "card-1",
      cardName: "Test Card",
      quantity: 1,
      tradeOverride: EMPTY_TRADE_PREFERENCE,
    },
  ],
};

const ruleDrivenListDetail = {
  ...cardKindListDetail,
  list: { ...cardKindListDetail.list, rules: [{ id: "rule-1" }] },
};

const emptyListDetail = { ...cardKindListDetail, entries: [] };

const copyKindListDetail = {
  list: { ...cardKindListDetail.list, kind: "copy", intent: "organize" },
  entries: [
    {
      id: null,
      kind: "copy",
      copyId: "copy-1",
      printingId: printingOnList.printingId,
      cardId: "card-1",
      cardName: "Test Card",
      quantity: 1,
      source: "rule",
      ruleQuantity: 1,
      reserved: false,
      onLoan: false,
      tradeOverride: EMPTY_TRADE_PREFERENCE,
    },
  ],
};

let listDetail:
  | typeof cardKindListDetail
  | typeof printingKindListDetail
  | typeof copyKindListDetail = cardKindListDetail;

function mutationStub() {
  return { mutate: vi.fn(), isPending: false, variables: undefined };
}

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const builder = {
      validator: () => builder,
      middleware: () => builder,
      handler: () => vi.fn(),
    };
    return builder;
  },
  createMiddleware: () => ({ server: () => ({}) }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: (props: { children?: unknown }) => <a href="#link">{props.children as never}</a>,
  createLink: (component: unknown) => component,
  useNavigate: () => vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal()),
  useQuery: () => ({ data: undefined }),
  useSuspenseQuery: () => ({ data: undefined }),
  useMutation: () => mutationStub(),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ data: null }),
  useUserId: () => "user-1",
  useRequiredUserId: () => "user-1",
}));

vi.mock("@/features/lists/hooks/use-lists", () => ({
  useListDetail: () => ({ data: listDetail }),
  useLists: () => ({ data: [] }),
  useCreateList: () => mutationStub(),
  useDeleteList: () => mutationStub(),
  useRemoveListEntry: () => mutationStub(),
  useUpdateListEntry: () => mutationStub(),
  useUpdateList: () => mutationStub(),
  useMoveListEntries: () => mutationStub(),
  useBulkAddListEntries: () => mutationStub(),
  useBulkRemoveListEntries: () => mutationStub(),
}));

vi.mock("@/features/groups/hooks/use-friend-groups", () => ({
  useFriendGroupsList: () => ({ data: undefined }),
}));

vi.mock("@/features/groups/hooks/use-friend-group-sharing", () => ({
  useShareListWithFriendGroup: () => mutationStub(),
}));

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({
    allPrintings: [printingOnList, printingOffList],
    printingsById: {
      [printingOnList.printingId]: printingOnList,
      [printingOffList.printingId]: printingOffList,
    },
    printingsByCardId: new Map([["card-1", [printingOnList, printingOffList]]]),
    sets: [],
  }),
}));

let sortedCards: (typeof printingOnList)[] = [];

vi.mock("@/features/cards/hooks/use-card-data", () => ({
  useCardData: () => ({
    sortedCards,
    printingsByCardId: new Map([["card-1", [printingOnList]]]),
    priceRangeByCardId: undefined,
    availableFilters: {},
    availableLanguages: [],
    filterCounts: {},
    setDisplayLabel: () => "",
    totalUniqueCards: 0,
    filteredCount: 0,
  }),
}));

vi.mock("@/features/cards/hooks/use-card-filters", () => ({
  useFilterValues: () => ({
    filters: { ownedFilter: [] },
    sortBy: "name",
    sortDir: "asc",
    groupBy: "none",
    groupDir: "asc",
    hasActiveFilters: false,
  }),
  useFilterActions: () => ({ setSearch: vi.fn() }),
}));

let selectedIds = new Set<string>();
const clearSelection = vi.fn();
const resetSelection = vi.fn();
const toggleSelectAll = vi.fn();
vi.mock("@/features/cards/hooks/use-card-selection", async () => {
  const { useGridSelectionStore: store } =
    await import("@/features/cards/stores/grid-selection-store");
  return {
    useCardSelection: () => ({
      selected: selectedIds,
      selectMode: store((s) => s.selectMode),
      setSelectMode: store((s) => s.setSelectMode),
      toggleSelect: vi.fn(),
      toggleSelectAll,
      clearSelection,
      resetSelection,
      getLastSelectedItemId: () => null,
      setLastSelectedItemId: vi.fn(),
      addToSelection: vi.fn(),
    }),
  };
});

vi.mock("@/features/collections/hooks/use-copies", () => ({
  useCopies: () => ({ data: [], isReady: true }),
  useCopyListMemberships: () => ({ data: undefined, isLoading: false }),
  useDisposeCopies: () => mutationStub(),
  useMoveCopies: () => mutationStub(),
}));

vi.mock("@/features/collections/hooks/use-collections", () => ({
  useCollections: () => ({ data: [{ id: "col-1", name: "Bulk box", isInbox: false }] }),
}));

vi.mock("@/hooks/use-enums", () => ({
  useChannelRegistry: () => new Map(),
  useEnumOrders: () => ({ orders: { rarities: [] }, labels: {} }),
}));

vi.mock("@/hooks/use-is-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/use-keyword-reverse-map", () => ({
  useKeywordReverseMap: () => new Map(),
}));

vi.mock("@/features/collections/hooks/use-owned-count", () => ({
  useOwnedCount: () => ({ data: undefined }),
}));

vi.mock("@/features/cards/hooks/use-card-thumbnail-display", () => ({
  useCardThumbnailDisplay: () => ({ favoriteMarketplace: null, prices: undefined }),
}));

vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => ({ toggleSidebar: vi.fn() }),
}));

vi.mock("@/features/cards/components/card-viewer", () => ({
  CardViewer: ({ rightPane, children }: { rightPane?: unknown; children?: unknown }) => (
    <div>
      {rightPane as never}
      {children as never}
    </div>
  ),
}));

vi.mock("@/features/cards/components/selection-detail-overlays", () => ({
  SelectionDetailOverlays: () => null,
}));

vi.mock("@/features/cards/components/selection-detail-pane", () => ({
  SelectionDetailPane: ({ printingsByCardId }: { printingsByCardId: Map<string, unknown[]> }) => (
    <div>Detail pane printings: {printingsByCardId.get("card-1")?.length ?? 0}</div>
  ),
}));

vi.mock("@/features/cards/components/card-browser-filter-scaffold", () => ({
  CardBrowserFilterProvider: ({ children }: { children?: unknown }) => children as never,
  BrowserToolbar: () => null,
  BrowserLeftPane: () => null,
  BrowserActiveFilters: () => null,
}));

vi.mock("@/features/lists/components/list-header", () => ({
  ListHeader: ({ actions }: { actions?: unknown }) => <div>{actions as never}</div>,
}));

vi.mock("@/features/lists/components/list-edit-dialog", () => ({ ListEditDialog: () => null }));
vi.mock("@/features/lists/components/delete-list-dialog", () => ({ DeleteListDialog: () => null }));
vi.mock("@/features/lists/components/list-share-dialog", () => ({
  ListShareDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="Share list" /> : null,
}));
vi.mock("@/features/lists/components/list-export-dialog", () => ({ ListExportDialog: () => null }));
vi.mock("@/features/lists/components/list-import-dialog", () => ({ ListImportDialog: () => null }));
vi.mock("@/features/lists/components/rule-editor-dialog", () => ({ RuleEditorDialog: () => null }));

const { ListPage } = await import("./list-page");
const { TopBarSlotContext } = await import("@/components/layout/top-bar-slot");
const { FilterSearchProvider } = await import("@/features/cards/hooks/use-filter-search");
const { useCardRowActionsStore } = await import("@/features/cards/stores/card-row-actions-store");
const { useGridFocusStore } = await import("@/features/cards/stores/grid-focus-store");
const { useGridSelectionStore } = await import("@/features/cards/stores/grid-selection-store");
const { useListEntriesStore } = await import("@/features/lists/stores/list-entries-store");
const { useSelectionStore } = await import("@/stores/selection-store");
const { useSiblingOverrideStore } = await import("@/features/cards/stores/sibling-override-store");

const resetters = [
  createStoreResetter(useCardRowActionsStore),
  createStoreResetter(useGridFocusStore),
  createStoreResetter(useGridSelectionStore),
  createStoreResetter(useListEntriesStore),
  createStoreResetter(useSelectionStore),
  createStoreResetter(useSiblingOverrideStore),
];

// The dropdown portals outside the render tree, and teardown wipes
// document.body before React unmounts, so an open menu must detach first.
async function closeOpenMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
}

function renderListPage() {
  const topBarSlot = document.createElement("div");
  document.body.append(topBarSlot);
  const view = render(
    <TopBarSlotContext value={topBarSlot}>
      <FilterSearchProvider value={{}}>
        <ListPage listId="list-1" />
      </FilterSearchProvider>
    </TopBarSlotContext>,
  );
  return { view, topBarSlot };
}

describe("ListPage", () => {
  afterEach(() => {
    for (const reset of resetters) {
      reset();
    }
    listDetail = cardKindListDetail;
    sortedCards = [];
    selectedIds = new Set();
    document.body.innerHTML = "";
  });

  it("offers Share from the top bar, not the actions menu", async () => {
    const user = userEvent.setup();
    renderListPage();

    expect(screen.getAllByRole("button", { name: "Share" })[0]).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "List actions" }));
    expect(await screen.findByRole("menuitem", { name: "Export…" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Share" })).not.toBeInTheDocument();
    await closeOpenMenu(user);
  });

  it("opens the share dialog from the mobile Share icon button", async () => {
    const user = userEvent.setup();
    renderListPage();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Share" })[0]!);
    expect(await screen.findByRole("dialog", { name: "Share list" })).toBeInTheDocument();
  });

  it("lists the actions menu in a fixed order for a card list", async () => {
    const user = userEvent.setup();
    renderListPage();

    await user.click(screen.getByRole("button", { name: "List actions" }));
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Edit",
      "Dynamic rules",
      "Import…",
      "Export…",
      "Delete list",
    ]);
    await closeOpenMenu(user);
  });

  it("omits Import… and offers moving copies to a collection for a copy list", async () => {
    listDetail = copyKindListDetail;
    const user = userEvent.setup();
    renderListPage();

    await user.click(screen.getByRole("button", { name: "List actions" }));
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Edit",
      "Dynamic rules",
      "Move copies to collection…",
      "Export…",
      "Delete list",
    ]);
    await closeOpenMenu(user);
  });

  it("disables moving copies to a collection when the list shows no copies", async () => {
    listDetail = copyKindListDetail;
    const user = userEvent.setup();
    renderListPage();

    await user.click(screen.getByRole("button", { name: "List actions" }));
    expect(
      await screen.findByRole("menuitem", { name: "Move copies to collection…" }),
    ).toHaveAttribute("aria-disabled", "true");
    await closeOpenMenu(user);
  });

  it("moves every shown copy, rule-produced ones included, from the actions menu", async () => {
    listDetail = copyKindListDetail;
    sortedCards = [printingOnList];
    const user = userEvent.setup();
    const { view } = renderListPage();

    await user.click(screen.getByRole("button", { name: "List actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Move copies to collection…" }));

    expect(await screen.findByText("Move 1 copy to collection")).toBeInTheDocument();
    view.unmount();
  });

  it("leads the copy selection bar with Move to collection and explains the rule lock", () => {
    listDetail = copyKindListDetail;
    sortedCards = [printingOnList];
    selectedIds = new Set(["rule:copy-1"]);
    useGridSelectionStore.setState({ selectMode: true });
    renderListPage();

    const bar = screen.getByLabelText("1 selected");
    const buttons = within(bar).getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("Move to collection");
    expect(buttons[0]).toBeEnabled();
    expect(within(bar).getByRole("button", { name: "Move to list" })).toBeDisabled();
    expect(within(bar).getByRole("button", { name: "Take off list" })).toBeDisabled();
    expect(within(bar).getByText(/The rule puts these copies on this list/u)).toBeInTheDocument();
  });

  it("keeps Move to collection off card lists and shows no lock note for manual entries", () => {
    sortedCards = [printingOnList];
    selectedIds = new Set(["entry-1"]);
    useGridSelectionStore.setState({ selectMode: true });
    renderListPage();

    const bar = screen.getByLabelText("1 selected");
    expect(within(bar).queryByRole("button", { name: "Move to collection" })).toBeNull();
    expect(within(bar).getByRole("button", { name: "Move to list" })).toBeEnabled();
    expect(within(bar).queryByText(/The rule puts these/u)).toBeNull();
  });

  it("keeps the rule editor out of the top bar and offers it in the menu", async () => {
    const user = userEvent.setup();
    renderListPage();

    expect(screen.queryByRole("button", { name: /dynamic rules/iu })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "List actions" }));
    expect(await screen.findByRole("menuitem", { name: "Dynamic rules" })).toBeInTheDocument();
    await closeOpenMenu(user);
  });

  it("leads the empty state with the dynamic-rules pitch", () => {
    listDetail = emptyListDetail;
    renderListPage();

    expect(screen.getByRole("button", { name: "Set up dynamic rules" })).toBeInTheDocument();
    expect(screen.getByText(/a dynamic list fills itself/iu)).toBeInTheDocument();
  });

  it("offers to edit the rules instead when a dynamic list matches nothing", () => {
    listDetail = { ...ruleDrivenListDetail, entries: [] };
    renderListPage();

    expect(screen.getByRole("button", { name: "Edit dynamic rules" })).toBeInTheDocument();
    expect(screen.getByText(/nothing matches this list's rules yet/iu)).toBeInTheDocument();
  });

  it("manages the selection from the top bar, like a collection does", async () => {
    sortedCards = [printingOnList];
    const user = userEvent.setup();
    renderListPage();

    expect(screen.getAllByRole("button", { name: "Manage cards" })[0]).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select all" })).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Manage cards" })[0]!);

    expect(screen.getAllByRole("button", { name: "Done" })[0]).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manage cards" })).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Select all" })[0]!);
    expect(toggleSelectAll).toHaveBeenCalledWith(["entry-1"]);

    await user.click(screen.getAllByRole("button", { name: "Done" })[0]!);
    expect(screen.getAllByRole("button", { name: "Manage cards" })[0]).toBeInTheDocument();
  });

  it("still manages a list whose entries all came from a dynamic rule", async () => {
    listDetail = copyKindListDetail;
    sortedCards = [printingOnList];
    const user = userEvent.setup();
    renderListPage();

    await user.click(screen.getAllByRole("button", { name: "Manage copies" })[0]!);
    await user.click(screen.getAllByRole("button", { name: "Select all" })[0]!);

    expect(toggleSelectAll).toHaveBeenCalledWith(["rule:copy-1"]);
  });

  it("feeds the detail pane every catalog printing of a card on a printing-kind list", () => {
    listDetail = printingKindListDetail;
    renderListPage();

    expect(screen.getByText("Detail pane printings: 2")).toBeInTheDocument();
  });
});
