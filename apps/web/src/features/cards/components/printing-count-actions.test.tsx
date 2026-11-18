import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { stubPrinting } from "@/test/factories";

const cardId = "card-chaos-rune";
const printingX = stubPrinting({ printingId: "p-x", cardId, card: { name: "Chaos Rune" } });
const printingY = stubPrinting({ printingId: "p-y", cardId, card: { name: "Chaos Rune" } });

let ownedByPrinting: Record<string, number> = {};
let scopedCollectionId: string | undefined;

const onIncrement = vi.fn();
const onDecrement = vi.fn();
const handlers = { onIncrement, onDecrement };

vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => true }));

vi.mock("@/features/cards/components/card-detail/owned-collections-popover", () => ({
  OwnedCollectionsPopover: ({ count, totalCount }: { count: number; totalCount?: number }) => (
    <span data-testid="owned-popover">
      {count}
      {totalCount !== undefined && totalCount !== count ? ` (${totalCount})` : ""}
    </span>
  ),
}));

vi.mock("@/features/collections/hooks/use-owned-count", () => ({
  useTileOwnedCounts: (
    printingId: string,
    siblingIds: readonly string[] | undefined,
    _enabled: boolean,
    collectionId?: string,
  ) => {
    scopedCollectionId = collectionId;
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

const { PrintingCountActions } = await import("./printing-count-actions");

describe("PrintingCountActions", () => {
  beforeEach(() => {
    ownedByPrinting = {};
    scopedCollectionId = undefined;
    onIncrement.mockClear();
    onDecrement.mockClear();
  });

  it("offers only the add control on a card with no copies", () => {
    render(<PrintingCountActions {...handlers} printing={printingX} />);

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByLabelText("Add Chaos Rune")).toBeInTheDocument();
    expect(screen.queryByLabelText("Remove Chaos Rune")).not.toBeInTheDocument();
  });

  it("drops the tile strip's bottom margin so it centers beside inline controls", () => {
    const { container } = render(<PrintingCountActions {...handlers} printing={printingX} />);

    expect(container.firstElementChild?.classList).not.toContain("mb-1");
  });

  it("shows the plain pill rather than the popover at zero", () => {
    render(<PrintingCountActions {...handlers} printing={printingX} />);

    expect(screen.queryByTestId("owned-popover")).not.toBeInTheDocument();
  });

  it("swaps the pill for the collections popover once a copy is owned", () => {
    ownedByPrinting = { "p-x": 2 };
    render(<PrintingCountActions {...handlers} printing={printingX} />);

    expect(screen.getByTestId("owned-popover")).toHaveTextContent("2");
    expect(screen.getByLabelText("Remove Chaos Rune")).toBeInTheDocument();
  });

  it("widens the total across siblings", () => {
    ownedByPrinting = { "p-x": 2, "p-y": 1 };
    render(
      <PrintingCountActions {...handlers} printing={printingX} siblings={[printingX, printingY]} />,
    );

    expect(screen.getByTestId("owned-popover")).toHaveTextContent("2 (3)");
  });

  it("omits the wider total for a card with a single variant", () => {
    ownedByPrinting = { "p-x": 2 };
    render(<PrintingCountActions {...handlers} printing={printingX} siblings={[printingX]} />);

    expect(screen.getByTestId("owned-popover")).toHaveTextContent("2");
    expect(screen.queryByText("(2)")).not.toBeInTheDocument();
  });

  it("scopes the count to a collection when one is given", () => {
    ownedByPrinting = { "p-x": 1 };
    render(<PrintingCountActions {...handlers} printing={printingX} collectionId="col-1" />);

    expect(scopedCollectionId).toBe("col-1");
  });

  it("counts across every collection when none is given", () => {
    ownedByPrinting = { "p-x": 1 };
    render(<PrintingCountActions {...handlers} printing={printingX} />);

    expect(scopedCollectionId).toBeUndefined();
  });

  it("dispatches increment and decrement", async () => {
    ownedByPrinting = { "p-x": 1 };
    render(<PrintingCountActions {...handlers} printing={printingX} />);

    await userEvent.click(screen.getByLabelText("Add Chaos Rune"));
    expect(onIncrement).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByLabelText("Remove Chaos Rune"));
    expect(onDecrement).toHaveBeenCalledTimes(1);
  });

  it("takes the caller's numbers instead of querying", () => {
    ownedByPrinting = { "p-x": 99 };
    render(<PrintingCountActions {...handlers} printing={printingX} count={2} totalCount={5} />);

    expect(screen.getByTestId("owned-popover")).toHaveTextContent("2 (5)");
  });

  it("takes an add label and a disabled add button from the caller", () => {
    render(
      <PrintingCountActions
        {...handlers}
        printing={printingX}
        count={0}
        addLabel="Add Chaos Rune to Inbox"
        incrementDisabled
      />,
    );

    expect(screen.getByLabelText("Add Chaos Rune to Inbox")).toBeDisabled();
  });
});
