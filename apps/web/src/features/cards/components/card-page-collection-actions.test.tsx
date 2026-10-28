import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubPrinting } from "@/test/factories";

const { collectionsMock, countsMock, quickAddMock, popoverHostProps } = vi.hoisted(() => ({
  collectionsMock: vi.fn(),
  countsMock: vi.fn(),
  quickAddMock: vi.fn(),
  popoverHostProps: [] as Record<string, unknown>[],
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: collectionsMock() }),
  queryOptions: (options: unknown) => options,
}));

vi.mock("@/features/collections/hooks/use-collections", () => ({
  useCollectionsList: () => collectionsMock(),
}));

vi.mock("@/hooks/use-session", () => ({
  useUserId: () => "user-1",
  useSession: () => ({ data: { user: { id: "user-1" } } }),
}));

vi.mock("@/features/collections/hooks/use-owned-count", () => ({
  useTileOwnedCounts: (printingId: string, siblingIds: readonly string[] | undefined) => {
    const data = countsMock();
    const total = data?.total ?? 0;
    return {
      count: data?.totals[printingId] ?? 0,
      total,
      totalCount: data && siblingIds !== undefined && siblingIds.length > 1 ? total : undefined,
      allTotal: data?.allTotal ?? 0,
    };
  },
}));

vi.mock("@/features/collections/hooks/use-quick-add-actions", () => ({
  useQuickAddActions: () => quickAddMock(),
}));

vi.mock("@/features/groups/hooks/use-wish-entries", () => ({
  useWishEntries: () => ({
    entriesForPrinting: () => [],
    matches: () => false,
    wishedQuantity: () => 0,
  }),
}));

vi.mock("@/features/lists/components/wishlist-picker-host", () => ({
  WishlistPickerHost: () => null,
}));

vi.mock("@/features/cards/components/card-detail/owned-collections-popover", () => ({
  OwnedCollectionsPopover: ({ count, totalCount }: { count: number; totalCount: number }) => (
    <span>{`breakdown ${count}${totalCount === undefined ? "" : `/${totalCount}`}`}</span>
  ),
}));

vi.mock("@/features/collections/components/variant-locations-popover-host", () => ({
  VariantLocationsPopoverHost: (props: Record<string, unknown>) => {
    popoverHostProps.push(props);
    return null;
  },
}));

vi.mock("@/features/collections/components/annotated-dispose-dialog", () => ({
  AnnotatedDisposeDialog: () => null,
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { CardPageCollectionActions } from "./card-page-collection-actions";

const printing = stubPrinting({ printingId: "printing-1", cardId: "card-1" });
const sibling = stubPrinting({ printingId: "printing-2", cardId: "card-1", finish: "foil" });

function stubActions(overrides: Record<string, unknown> = {}) {
  return {
    handleQuickAdd: vi.fn(),
    handleAddToCollection: vi.fn(),
    tryUndoAdd: vi.fn().mockResolvedValue("done"),
    handleOpenVariants: vi.fn(),
    handleDisposeFromCollection: vi.fn(),
    closeVariants: vi.fn(),
    pendingAnnotatedDispose: null,
    confirmAnnotatedDispose: vi.fn(),
    cancelAnnotatedDispose: vi.fn(),
    disposeIsPending: false,
    ...overrides,
  };
}

describe("CardPageCollectionActions", () => {
  beforeEach(() => {
    popoverHostProps.length = 0;
    collectionsMock.mockReturnValue([{ id: "inbox-1", name: "Inbox", isInbox: true }]);
    countsMock.mockReturnValue({
      totals: { "printing-1": 2, "printing-2": 3 },
      total: 5,
      allTotals: { "printing-1": 2, "printing-2": 3 },
      allTotal: 5,
    });
    quickAddMock.mockReturnValue(stubActions());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("adds to the inbox and names it in the button label", async () => {
    const handleQuickAdd = vi.fn();
    quickAddMock.mockReturnValue(stubActions({ handleQuickAdd }));
    render(<CardPageCollectionActions printing={printing} siblings={[printing, sibling]} />);

    await userEvent.click(screen.getByRole("button", { name: /Add .+ to Inbox/u }));

    expect(handleQuickAdd).toHaveBeenCalledWith(printing);
  });

  it("shows the printing count without the card total", () => {
    render(<CardPageCollectionActions printing={printing} siblings={[printing, sibling]} />);

    expect(screen.getByText("Owned")).toBeInTheDocument();
    expect(screen.getByText("breakdown 2")).toBeInTheDocument();
  });

  it("hides the minus while the printing has no copies to remove", () => {
    countsMock.mockReturnValue({ totals: {}, total: 0, allTotals: {}, allTotal: 0 });
    render(<CardPageCollectionActions printing={printing} siblings={[printing]} />);

    expect(screen.queryByRole("button", { name: /^Remove/u })).not.toBeInTheDocument();
  });

  it("removes silently when the copies sit in one collection", async () => {
    const tryUndoAdd = vi.fn().mockResolvedValue("done");
    const handleOpenVariants = vi.fn();
    quickAddMock.mockReturnValue(stubActions({ tryUndoAdd, handleOpenVariants }));
    render(<CardPageCollectionActions printing={printing} siblings={[printing]} />);

    await userEvent.click(screen.getByRole("button", { name: /^Remove/u }));

    expect(tryUndoAdd).toHaveBeenCalledWith(printing);
    expect(handleOpenVariants).not.toHaveBeenCalled();
  });

  it("escalates an ambiguous removal to the printing-scoped variant popover", async () => {
    const tryUndoAdd = vi.fn().mockResolvedValue("ambiguous");
    const handleOpenVariants = vi.fn();
    quickAddMock.mockReturnValue(stubActions({ tryUndoAdd, handleOpenVariants }));
    render(<CardPageCollectionActions printing={printing} siblings={[printing, sibling]} />);

    await userEvent.click(screen.getByRole("button", { name: /^Remove/u }));

    expect(handleOpenVariants).toHaveBeenCalledWith(
      printing,
      expect.any(HTMLElement),
      "remove",
      false,
      true,
    );
  });

  it("disables the plus until a target collection is known", () => {
    collectionsMock.mockReturnValue(undefined);
    quickAddMock.mockReturnValue(stubActions({ handleQuickAdd: undefined }));
    render(<CardPageCollectionActions printing={printing} siblings={[printing]} />);

    expect(screen.getByRole("button", { name: /^Add (?!.*wishlist)/u })).toBeDisabled();
  });

  it("hands the variant popover only this card's printings", () => {
    render(<CardPageCollectionActions printing={printing} siblings={[printing, sibling]} />);

    const props = popoverHostProps.at(-1);
    const map = props?.catalogPrintingsByCardId as Map<string, unknown[]>;
    expect(map.get("card-1")).toHaveLength(2);
    expect(props?.defaultTargetCollectionId).toBe("inbox-1");
  });
});
