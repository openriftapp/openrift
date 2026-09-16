import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { stubPrinting } from "@/test/factories";

const cardId = "card-chaos-rune";
const printingX = stubPrinting({ id: "p-x", cardId, card: { name: "Chaos Rune" } });

let ownedByPrinting: Record<string, number> = {};

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

// oxlint-disable-next-line import/first -- must import after vi.mock
const { TableCountActions } = await import("./table-count-actions");

describe("TableCountActions", () => {
  beforeEach(() => {
    ownedByPrinting = {};
  });

  it("offers the add control on a card with no copies", () => {
    render(<TableCountActions printing={printingX} />);

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add one" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Remove one" })).toBeDisabled();
  });

  it("enables the remove control once a copy is owned", () => {
    ownedByPrinting = { "p-x": 2 };
    render(<TableCountActions printing={printingX} />);

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove one" })).toBeEnabled();
  });

  it("adds the card-wide total when copies are spread over several variants", () => {
    ownedByPrinting = { "p-x": 2, "p-y": 1 };
    render(<TableCountActions printing={printingX} siblingIds={["p-x", "p-y"]} />);

    expect(screen.getByText("(3)")).toBeInTheDocument();
  });

  it("keeps the card-wide total on a variant the viewer owns none of", () => {
    ownedByPrinting = { "p-y": 2 };
    render(<TableCountActions printing={printingX} siblingIds={["p-x", "p-y"]} />);

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("(2)")).toBeInTheDocument();
  });

  it("omits the total on a row that stands for one printing", () => {
    ownedByPrinting = { "p-x": 2 };
    render(<TableCountActions printing={printingX} />);

    expect(screen.queryByText("(2)")).not.toBeInTheDocument();
  });
});
