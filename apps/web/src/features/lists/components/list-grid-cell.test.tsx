import type { ListEntryDetailResponse } from "@openrift/shared/types/api/list";
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CardRowActionsStore } from "@/features/cards/stores/card-row-actions-store";
import {
  CardRowActionsStoreContext,
  createCardRowActionsStore,
} from "@/features/cards/stores/card-row-actions-store";
import type { ListEntriesStore } from "@/features/lists/stores/list-entries-store";
import {
  createListEntriesStore,
  ListEntriesStoreContext,
} from "@/features/lists/stores/list-entries-store";
import { layoutStoresWrapper } from "@/test/collection-layout-stores";
import { stubPrinting } from "@/test/factories";

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

let listEntries: ListEntriesStore;
let rowActions: CardRowActionsStore;

beforeEach(() => {
  listEntries = createListEntriesStore();
  rowActions = createCardRowActionsStore();
  listEntries.setState({ entryByItemId: new Map([["item-1", entry]]) });
});

function registerPending(pending: boolean) {
  rowActions.getState().setHandlers({
    isQuantityPendingFor: (entryId) => pending && entryId === "entry-1",
  });
}

function renderCell(showLibrary: boolean) {
  return render(
    <ListEntriesStoreContext value={listEntries}>
      <CardRowActionsStoreContext value={rowActions}>
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
        />
      </CardRowActionsStoreContext>
    </ListEntriesStoreContext>,
    { wrapper: layoutStoresWrapper() },
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
    listEntries.setState({ entryByKey: new Map([[printing.cardId, entry]]) });
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
