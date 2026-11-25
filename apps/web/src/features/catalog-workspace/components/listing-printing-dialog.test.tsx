import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CardListingRow } from "@/features/catalog-workspace/lib/card-listing-rows";

import { ListingPrintingDialog, listingHighlight } from "./listing-printing-dialog";

const searched = vi.hoisted(() => ({ language: undefined as string | null | undefined }));

vi.mock("./listing-any-printing-combobox", () => ({
  ListingAnyPrintingCombobox: ({ language }: { language: string | null }) => {
    searched.language = language;
    return null;
  },
}));

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

describe("listingHighlight", () => {
  it("does not highlight the placeholder language of a Cardmarket listing", () => {
    const listing = row({ marketplace: "cardmarket" } as Partial<CardListingRow>);
    expect(listingHighlight(listing).language).toBeUndefined();
  });

  it("highlights a stocked language and the markers of a special listing", () => {
    const listing = row({
      marketplace: "tcgplayer",
      product: { externalId: 1, finish: "foil", language: "EN", groupKind: "special" },
    } as unknown as Partial<CardListingRow>);
    expect(listingHighlight(listing)).toEqual({ finish: "foil", language: "EN", markers: true });
  });
});

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

  it("searches every language of other cards for a Cardmarket listing", async () => {
    const user = userEvent.setup();
    render(
      <ListingPrintingDialog
        row={row({ marketplace: "cardmarket" } as Partial<CardListingRow>)}
        open
        pending={false}
        onOpenChange={vi.fn()}
        onPick={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Search printings of all cards" }));

    expect(searched.language).toBeNull();
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
