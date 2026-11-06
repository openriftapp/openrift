import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CardListingRow } from "@/features/catalog-workspace/lib/card-listing-rows";

import { ListingPrintingDialog } from "./listing-printing-dialog";

function printing(printingId: string, shortCode: string, finish: string) {
  return { printingId, shortCode, markerSlugs: [], finish, language: "EN", size: null };
}

function row(overrides: Partial<CardListingRow> = {}): CardListingRow {
  return {
    product: { externalId: 4242, finish: "foil", language: "EN" },
    assignedPrintings: [],
    assignablePrintings: [printing("p1", "OGN-030", "normal"), printing("p2", "OGN-030", "foil")],
    ...overrides,
  } as unknown as CardListingRow;
}

describe("ListingPrintingDialog", () => {
  it("picks a printing with the arrow keys", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(
      <ListingPrintingDialog
        row={row()}
        open
        pending={false}
        onOpenChange={vi.fn()}
        onPick={onPick}
      />,
    );

    await user.type(screen.getByRole("combobox", { name: "Printing" }), "foil");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onPick).toHaveBeenCalledExactlyOnceWith("p2");
  });

  it("disables printings the listing already points at", async () => {
    const user = userEvent.setup();
    const assigned = printing("p1", "OGN-030", "normal");
    render(
      <ListingPrintingDialog
        row={row({
          assignedPrintings: [assigned] as unknown as CardListingRow["assignedPrintings"],
        })}
        open
        pending={false}
        onOpenChange={vi.fn()}
        onPick={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Printing" }));
    await user.keyboard("{ArrowDown}");

    const options = await screen.findAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-disabled", "true");
    expect(options[1]).not.toHaveAttribute("aria-disabled", "true");
  });

  it("explains when no printing carries the listing's language", () => {
    render(
      <ListingPrintingDialog
        row={row({ assignablePrintings: [] })}
        open
        pending={false}
        onOpenChange={vi.fn()}
        onPick={vi.fn()}
      />,
    );

    expect(screen.getByText("No printing of this card carries its language.")).toBeInTheDocument();
  });

  it("lists every printing as soon as the dialog opens", () => {
    render(
      <ListingPrintingDialog
        row={row()}
        open
        pending={false}
        onOpenChange={vi.fn()}
        onPick={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("picks a printing with a click", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(
      <ListingPrintingDialog
        row={row()}
        open
        pending={false}
        onOpenChange={vi.fn()}
        onPick={onPick}
      />,
    );

    await user.click(screen.getAllByRole("option")[1] as HTMLElement);

    expect(onPick).toHaveBeenCalledExactlyOnceWith("p2");
  });
});
