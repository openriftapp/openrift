import type { ListEntryDetailResponse } from "@openrift/shared/types/api/list";
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCardRowActionsStore } from "@/features/cards/stores/card-row-actions-store";
import { useListEntriesStore } from "@/features/lists/stores/list-entries-store";
import { stubPrinting } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

vi.mock("@/features/cards/components/card-cell", () => ({
  CardCell: ({ strip }: { strip?: ReactNode }) => <div>{strip}</div>,
}));
vi.mock("@/features/lists/lib/list-trade-status", () => ({
  listEntryTradeStatus: () => null,
  listEntryTrades: () => [],
}));

const { ListGridCell } = await import("./list-grid-cell");

const printing = stubPrinting({ printingId: "p-jinx", card: { name: "Jinx, Loose Cannon" } });

const entry = {
  id: "entry-1",
  listId: "list-1",
  kind: "card",
  cardId: printing.cardId,
  cardName: "Jinx, Loose Cannon",
  quantity: 2,
  ruleQuantity: 0,
  source: "manual",
  tradeOverride: { pricePref: null, priceAbsoluteCents: null, tradeType: null },
} as ListEntryDetailResponse;

let resetEntries: () => void;
let resetActions: () => void;

beforeEach(() => {
  resetEntries = createStoreResetter(useListEntriesStore);
  resetActions = createStoreResetter(useCardRowActionsStore);
  useListEntriesStore.setState({ entryByItemId: new Map([["item-1", entry]]) });
});

afterEach(() => {
  resetEntries();
  resetActions();
});

function registerPending(pending: boolean) {
  useCardRowActionsStore.getState().setHandlers("list", {
    isQuantityPendingFor: (entryId) => pending && entryId === "entry-1",
  });
}

function renderCell(showLibrary: boolean) {
  return render(
    <ListGridCell
      printing={printing}
      itemId="item-1"
      cardWidth={200}
      priority={false}
      dataView="cards"
      view="cards"
      kind="card"
      intent="wish"
      listId="list-1"
      listTradeDefaults={entry.tradeOverride}
      listCurrency={null}
      mode="browse"
      selectionHasRuleEntry={false}
      showLibrary={showLibrary}
      supportsTradePrefs={false}
      siblings={undefined}
      display={{} as never}
      showImages={false}
      tradeIndex={{} as never}
    />,
  );
}

describe("ListGridCell quantity strip", () => {
  it("re-enables +/- once the entry's quantity write settles", () => {
    registerPending(true);
    renderCell(false);
    const increase = screen.getByRole("button", { name: "Increase Jinx, Loose Cannon quantity" });
    expect(increase).toBeDisabled();

    act(() => registerPending(false));

    expect(increase).toBeEnabled();
    expect(screen.getByRole("button", { name: /Decrease Jinx, Loose Cannon/u })).toBeEnabled();
  });

  it("disables Add and Decrease in the library view while a write for the entry is pending", () => {
    useListEntriesStore.setState({ entryByKey: new Map([[printing.cardId, entry]]) });
    registerPending(true);
    renderCell(true);
    const add = screen.getByRole("button", { name: "Add Jinx, Loose Cannon to list" });
    const decrease = screen.getByRole("button", {
      name: "Decrease Jinx, Loose Cannon quantity on list",
    });
    expect(add).toBeDisabled();
    expect(decrease).toBeDisabled();

    act(() => registerPending(false));

    expect(add).toBeEnabled();
    expect(decrease).toBeEnabled();
  });
});
