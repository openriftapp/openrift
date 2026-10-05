import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { stubCard } from "@/test/factories";

const ahri = stubCard({ slug: "ahri-alluring", name: "Ahri, Alluring" });
const catalog = vi.hoisted(() => ({
  cardsById: {} as Record<string, unknown>,
  printingsById: {},
  printingsByCardId: new Map(),
  allPrintings: [],
  sets: [],
}));

vi.mock("@/features/cards/hooks/use-cards", () => ({ useCards: () => catalog }));
vi.mock("@/features/cards/hooks/use-catalog-card-search", () => ({
  useCatalogCardSearch: () => [],
}));
vi.mock("@/features/cards/components/card-search-dropdown", () => ({
  CardSearchDropdown: ({ onSelect }: { onSelect: (cardId: string) => void }) => (
    <>
      <button type="button" onClick={() => onSelect("card-ahri")}>
        pick ahri
      </button>
      <button type="button" onClick={() => onSelect("card-missing")}>
        pick missing
      </button>
    </>
  ),
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { CatalogCardPicker } from "./catalog-card-picker";

describe("CatalogCardPicker", () => {
  it("shows only the trigger until it is opened", () => {
    render(<CatalogCardPicker label="Search for a card" onPick={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Search for a card" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "pick ahri" })).not.toBeInTheDocument();
  });

  it("passes the picked card and the catalog, then closes", async () => {
    catalog.cardsById = { "card-ahri": ahri };
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<CatalogCardPicker label="Search for a card" onPick={onPick} />);

    await user.click(screen.getByRole("button", { name: "Search for a card" }));
    await user.click(await screen.findByRole("button", { name: "pick ahri" }));

    expect(onPick).toHaveBeenCalledWith(ahri, catalog, "card-ahri");
    expect(screen.getByRole("button", { name: "Search for a card" })).toBeInTheDocument();
  });

  it("ignores a pick whose card is not in the catalog", async () => {
    catalog.cardsById = {};
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<CatalogCardPicker label="Search for a card" onPick={onPick} />);

    await user.click(screen.getByRole("button", { name: "Search for a card" }));
    await user.click(await screen.findByRole("button", { name: "pick missing" }));

    expect(onPick).not.toHaveBeenCalled();
  });
});
