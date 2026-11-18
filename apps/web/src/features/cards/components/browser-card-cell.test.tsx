import type * as ReactRouter from "@tanstack/react-router";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CardThumbnailDisplay } from "@/features/cards/hooks/use-card-thumbnail-display";
import type { CardRowActionsStore } from "@/features/cards/stores/card-row-actions-store";
import {
  CardRowActionsStoreContext,
  createCardRowActionsStore,
} from "@/features/cards/stores/card-row-actions-store";
import type { WishEntryFlat } from "@/features/groups/lib/wish-entry";
import { stubPrinting } from "@/test/factories";

const cardId = "card-chaos-rune";
const printingX = stubPrinting({ printingId: "p-x", cardId, card: { name: "Chaos Rune" } });
const printingY = stubPrinting({ printingId: "p-y", cardId, card: { name: "Chaos Rune" } });

let ownedByPrinting: Record<string, number> = {};

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouter>()),
  useRouter: () => ({ buildLocation: () => ({ href: "/cards/stub" }) }),
}));

vi.mock("@/features/collections/hooks/use-owned-count", () => ({
  useTileOwnedCounts: (printingId: string, siblingIds: readonly string[] | undefined) => {
    const ids = siblingIds ?? [printingId];
    let total = 0;
    for (const id of ids) {
      total += ownedByPrinting[id] ?? 0;
    }
    return {
      count: ownedByPrinting[printingId] ?? 0,
      total,
      totalCount: siblingIds !== undefined && siblingIds.length > 1 ? total : undefined,
      allTotal: total,
    };
  },
}));

vi.mock("@/features/cards/components/card-detail/owned-collections-popover", () => ({
  OwnedCollectionsPopover: () => <span>breakdown</span>,
}));

interface StripProbeProps {
  decrement?: { onClick: (event: { currentTarget: HTMLElement }) => void };
  increment?: { onClick: (event: { currentTarget: HTMLElement }) => void };
  onPillClick?: (event: { currentTarget: HTMLElement }) => void;
  pillOverride?: ReactNode;
  extras?: ReactNode;
}

let strip: ReactElement<StripProbeProps> | undefined;
let contextMenu: ReactNode;
let cellRenders = 0;

// Mounting the real strip would drag in popover trees this test has no providers for.
vi.mock("@/features/cards/components/card-cell", () => ({
  CardCell: ({
    strip: cellStrip,
    contextMenu: cellMenu,
  }: {
    strip?: ReactElement<StripProbeProps>;
    contextMenu?: ReactNode;
  }) => {
    strip = cellStrip;
    contextMenu = cellMenu;
    cellRenders++;
    return <div>{cellStrip?.props.extras}</div>;
  },
}));

const { BrowserCardCell } = await import("./browser-card-cell");

const display = { getFallbackArt: () => null } as unknown as CardThumbnailDisplay;

let rowActions: CardRowActionsStore;

function cellElement(props: {
  canAdd: boolean;
  canWish?: boolean;
  showStrip?: boolean;
  inCardsView?: boolean;
  siblings?: (typeof printingX)[];
  wishEntries?: readonly WishEntryFlat[];
}) {
  const inCardsView = props.inCardsView ?? true;
  return (
    <BrowserCardCell
      printing={printingX}
      itemId="p-x"
      siblings={props.siblings ?? [printingX]}
      cardWidth={200}
      priority={false}
      showImages
      view={inCardsView ? "cards" : "printings"}
      display={display}
      priceRange={undefined}
      showStrip={props.showStrip ?? true}
      canAdd={props.canAdd}
      canWish={props.canWish ?? false}
      addTargetName={props.canAdd ? "Inbox" : undefined}
      wishEntries={props.wishEntries}
      inCardsView={inCardsView}
    />
  );
}

function renderCell(props: Parameters<typeof cellElement>[0]) {
  return render(
    <CardRowActionsStoreContext value={rowActions}>
      {cellElement(props)}
    </CardRowActionsStoreContext>,
  );
}

function resetHandlers() {
  rowActions = createCardRowActionsStore();
  ownedByPrinting = {};
  strip = undefined;
  contextMenu = undefined;
  cellRenders = 0;
}

describe("BrowserCardCell strip", () => {
  beforeEach(resetHandlers);
  afterEach(resetHandlers);

  it("stays read-only when the browser has no add target", () => {
    ownedByPrinting = { "p-x": 2 };
    renderCell({ canAdd: false });

    expect(strip?.props.increment).toBeUndefined();
    expect(strip?.props.decrement).toBeUndefined();
    expect(strip?.props.onPillClick).toBeUndefined();
    expect(strip?.props.pillOverride).toBeDefined();
  });

  it("renders no strip at all when counts are hidden", () => {
    renderCell({ canAdd: true, showStrip: false });

    expect(strip).toBeUndefined();
  });

  it("offers only a plus on an unowned card with a single variant", () => {
    renderCell({ canAdd: true });

    expect(strip?.props.increment).toBeDefined();
    expect(strip?.props.decrement).toBeUndefined();
    expect(strip?.props.onPillClick).toBeUndefined();
    expect(strip?.props.pillOverride).toBeDefined();
  });

  it("offers a minus and the variant popover once a copy is owned", () => {
    ownedByPrinting = { "p-x": 1 };
    renderCell({ canAdd: true });

    expect(strip?.props.decrement).toBeDefined();
    expect(strip?.props.onPillClick).toBeDefined();
    expect(strip?.props.pillOverride).toBeUndefined();
  });

  it("opens the variant popover on an unowned card that has several variants", () => {
    renderCell({ canAdd: true, siblings: [printingX, printingY] });

    expect(strip?.props.onPillClick).toBeDefined();
  });

  it("keeps the pill read-only in printings view, where a tile is one variant", () => {
    renderCell({ canAdd: true, inCardsView: false, siblings: [printingX, printingY] });

    expect(strip?.props.onPillClick).toBeUndefined();
  });

  it("dispatches a plus to the registered catalog handler", () => {
    const onIncrement = vi.fn();
    rowActions.getState().setHandlers({ onIncrement });
    renderCell({ canAdd: true });

    strip?.props.increment?.onClick({ currentTarget: document.createElement("button") });

    expect(onIncrement).toHaveBeenCalledWith(printingX, undefined);
  });

  it("always wraps the cell in its context menu, the add path that survives the counts toggle", () => {
    renderCell({ canAdd: false, canWish: false, showStrip: false });

    expect(contextMenu).toBeDefined();
  });

  it("hands the minus its anchor so the handler can open the popover against it", () => {
    const onDecrement = vi.fn();
    rowActions.getState().setHandlers({ onDecrement });
    ownedByPrinting = { "p-x": 1 };
    renderCell({ canAdd: true });

    const anchor = document.createElement("button");
    strip?.props.decrement?.onClick({ currentTarget: anchor });

    expect(onDecrement).toHaveBeenCalledWith(printingX, anchor, undefined);
  });
});

describe("BrowserCardCell wishlist affordance", () => {
  beforeEach(resetHandlers);
  afterEach(resetHandlers);

  it("offers nothing to a signed-out visitor", () => {
    renderCell({ canAdd: false, canWish: false });

    expect(strip?.props.extras).toBeUndefined();
    expect(screen.queryByRole("button", { name: /wishlist/u })).not.toBeInTheDocument();
  });

  it("offers a hollow heart on a card the viewer has not wished for", () => {
    renderCell({ canAdd: true, canWish: true });

    expect(
      screen.getByRole("button", { name: "Add Chaos Rune to a wishlist" }),
    ).toBeInTheDocument();
  });

  it("opens the picker for the card the heart belongs to", async () => {
    const onAddToWishlist = vi.fn();
    rowActions.getState().setHandlers({ onAddToWishlist });
    renderCell({ canAdd: true, canWish: true });

    await userEvent.click(screen.getByRole("button", { name: "Add Chaos Rune to a wishlist" }));

    expect(onAddToWishlist).toHaveBeenCalledWith(printingX);
  });

  it("fills the heart once the card is on a wishlist", () => {
    renderCell({
      canAdd: true,
      canWish: true,
      wishEntries: [
        {
          entryId: "e-1",
          listId: "l-1",
          listName: "Chase cards",
          kind: "card",
          cardId,
          quantity: 2,
        },
      ],
    });

    expect(
      screen.queryByRole("button", { name: "Add Chaos Rune to a wishlist" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /On your wishlist, 2 wanted/u })).toBeInTheDocument();
  });
});

describe("BrowserCardCell row actions", () => {
  beforeEach(resetHandlers);
  afterEach(resetHandlers);

  it("dispatches to the handlers of the surface it is mounted in", async () => {
    const catalogWish = vi.fn();
    const deckWish = vi.fn();
    const deckActions = createCardRowActionsStore();
    rowActions.getState().setHandlers({ onAddToWishlist: catalogWish });
    deckActions.getState().setHandlers({ onAddToWishlist: deckWish });
    render(
      <>
        <CardRowActionsStoreContext value={rowActions}>
          {cellElement({ canAdd: false, canWish: true })}
        </CardRowActionsStoreContext>
        <CardRowActionsStoreContext value={deckActions}>
          {cellElement({ canAdd: false, canWish: true })}
        </CardRowActionsStoreContext>
      </>,
    );
    const [catalogHeart, deckHeart] = screen.getAllByRole("button", {
      name: "Add Chaos Rune to a wishlist",
    });

    await userEvent.click(deckHeart!);
    expect(deckWish).toHaveBeenCalledWith(printingX);
    expect(catalogWish).not.toHaveBeenCalled();

    await userEvent.click(catalogHeart!);
    expect(catalogWish).toHaveBeenCalledWith(printingX);
    expect(deckWish).toHaveBeenCalledTimes(1);
  });

  it("does not re-render when the surface swaps its handlers, and dispatches to the new ones", async () => {
    const first = vi.fn();
    rowActions.getState().setHandlers({ onAddToWishlist: first });
    renderCell({ canAdd: false, canWish: true });
    const rendersAfterMount = cellRenders;

    const second = vi.fn();
    act(() => rowActions.getState().setHandlers({ onAddToWishlist: second }));

    expect(cellRenders).toBe(rendersAfterMount);
    await userEvent.click(screen.getByRole("button", { name: "Add Chaos Rune to a wishlist" }));
    expect(second).toHaveBeenCalledWith(printingX);
    expect(first).not.toHaveBeenCalled();
  });
});
