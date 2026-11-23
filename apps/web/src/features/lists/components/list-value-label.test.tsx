import type { ListEntryDetailResponse } from "@openrift/shared/types/api/list";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDisplayStore } from "@/stores/display-store";
import { EMPTY_TRADE_PREFERENCE, stubPriceLookup, stubPrinting } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

const printing = stubPrinting();

vi.mock("@/features/cards/hooks/use-prices", () => ({
  usePrices: () =>
    stubPriceLookup({ [printing.printingId]: { cardtrader: 5, tcgplayer: 6, cardmarket: 4 } }),
}));
vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({ printingsByCardId: new Map() }),
}));
vi.mock("@/hooks/use-effective-language-order", () => ({
  useEffectiveLanguageOrder: () => ["EN"],
}));

const { ListValueLabel } = await import("./list-value-label");

const resetDisplayStore = createStoreResetter(useDisplayStore);

beforeEach(() => {
  resetDisplayStore();
});

afterEach(() => {
  resetDisplayStore();
});

const entries: ListEntryDetailResponse[] = [
  {
    id: "entry-1",
    listId: "list-1",
    kind: "printing",
    printingId: printing.printingId,
    cardName: "Test",
    quantity: 2,
    setId: printing.setId,
    rarity: printing.rarity,
    finish: printing.finish,
    shortCode: printing.shortCode,
    language: printing.language,
    imageId: null,
    ruleQuantity: 0,
    source: "manual",
    tradeOverride: EMPTY_TRADE_PREFERENCE,
  },
];

describe("ListValueLabel", () => {
  it("shows the total in the favorite marketplace and lists every enabled marketplace", async () => {
    useDisplayStore.getState().setMarketplaceOrder(["tcgplayer", "cardmarket"]);
    const user = userEvent.setup();
    render(<ListValueLabel kind="printing" entries={entries} />);

    const trigger = screen.getByRole("button", { name: /TCGplayer.*\$12\.00/u });
    await user.click(trigger);

    const popup = await screen.findByRole("dialog", { name: "Value by marketplace" });
    const terms = within(popup)
      .getAllByRole("term")
      .map((term) => term.textContent);
    expect(terms).toEqual(["TCGplayer", "Cardmarket"]);
    const values = within(popup)
      .getAllByRole("definition")
      .map((value) => value.textContent);
    expect(values).toEqual(["$12.00", "€8.00"]);
  });
});
