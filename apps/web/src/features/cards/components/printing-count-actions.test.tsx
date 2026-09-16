import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { stubPrinting } from "@/test/factories";

const cardId = "card-chaos-rune";
const printingX = stubPrinting({ id: "p-x", cardId, card: { name: "Chaos Rune" } });
const printingY = stubPrinting({ id: "p-y", cardId, card: { name: "Chaos Rune" } });

let ownedByPrinting: Record<string, number> = {};
let scopedCollectionId: string | undefined;

const dispatchIncrement = vi.fn();
const dispatchDecrement = vi.fn();

vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => true }));

vi.mock("@/features/cards/stores/card-row-actions-store", () => ({
  dispatchIncrement: (...args: unknown[]) => dispatchIncrement(...args),
  dispatchDecrement: (...args: unknown[]) => dispatchDecrement(...args),
}));

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

// oxlint-disable-next-line import/first -- must import after vi.mock
const { PrintingCountActions } = await import("./printing-count-actions");

describe("PrintingCountActions", () => {
  beforeEach(() => {
    ownedByPrinting = {};
    scopedCollectionId = undefined;
    dispatchIncrement.mockClear();
    dispatchDecrement.mockClear();
  });

  it("offers only the add control on a card with no copies", () => {
    render(<PrintingCountActions printing={printingX} />);

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByLabelText("Add Chaos Rune")).toBeInTheDocument();
    expect(screen.queryByLabelText("Remove Chaos Rune")).not.toBeInTheDocument();
  });

  it("shows the plain pill rather than the popover at zero", () => {
    render(<PrintingCountActions printing={printingX} />);

    expect(screen.queryByTestId("owned-popover")).not.toBeInTheDocument();
  });

  it("swaps the pill for the collections popover once a copy is owned", () => {
    ownedByPrinting = { "p-x": 2 };
    render(<PrintingCountActions printing={printingX} />);

    expect(screen.getByTestId("owned-popover")).toHaveTextContent("2");
    expect(screen.getByLabelText("Remove Chaos Rune")).toBeInTheDocument();
  });

  it("widens the total across siblings", () => {
    ownedByPrinting = { "p-x": 2, "p-y": 1 };
    render(<PrintingCountActions printing={printingX} siblings={[printingX, printingY]} />);

    expect(screen.getByTestId("owned-popover")).toHaveTextContent("2 (3)");
  });

  it("omits the wider total for a card with a single variant", () => {
    ownedByPrinting = { "p-x": 2 };
    render(<PrintingCountActions printing={printingX} siblings={[printingX]} />);

    expect(screen.getByTestId("owned-popover")).toHaveTextContent("2");
    expect(screen.queryByText("(2)")).not.toBeInTheDocument();
  });

  it("scopes the count to a collection when one is given", () => {
    ownedByPrinting = { "p-x": 1 };
    render(<PrintingCountActions printing={printingX} collectionId="col-1" />);

    expect(scopedCollectionId).toBe("col-1");
  });

  it("counts across every collection when none is given", () => {
    ownedByPrinting = { "p-x": 1 };
    render(<PrintingCountActions printing={printingX} />);

    expect(scopedCollectionId).toBeUndefined();
  });

  it("dispatches increment and decrement", async () => {
    ownedByPrinting = { "p-x": 1 };
    render(<PrintingCountActions printing={printingX} />);

    await userEvent.click(screen.getByLabelText("Add Chaos Rune"));
    expect(dispatchIncrement).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByLabelText("Remove Chaos Rune"));
    expect(dispatchDecrement).toHaveBeenCalledTimes(1);
  });

  it("takes the caller's numbers instead of querying", () => {
    ownedByPrinting = { "p-x": 99 };
    render(<PrintingCountActions printing={printingX} count={2} totalCount={5} />);

    expect(screen.getByTestId("owned-popover")).toHaveTextContent("2 (5)");
  });

  it("prefers the caller's handlers over the row dispatchers", async () => {
    const onIncrement = vi.fn();
    const onDecrement = vi.fn();
    render(
      <PrintingCountActions
        printing={printingX}
        count={1}
        onIncrement={onIncrement}
        onDecrement={onDecrement}
      />,
    );

    await userEvent.click(screen.getByLabelText("Add Chaos Rune"));
    await userEvent.click(screen.getByLabelText("Remove Chaos Rune"));

    expect(onIncrement).toHaveBeenCalledWith(printingX);
    expect(onDecrement).toHaveBeenCalledTimes(1);
    expect(dispatchIncrement).not.toHaveBeenCalled();
    expect(dispatchDecrement).not.toHaveBeenCalled();
  });

  it("takes an add label and a disabled add button from the caller", () => {
    render(
      <PrintingCountActions
        printing={printingX}
        count={0}
        addLabel="Add Chaos Rune to Inbox"
        incrementDisabled
      />,
    );

    expect(screen.getByLabelText("Add Chaos Rune to Inbox")).toBeDisabled();
  });
});
