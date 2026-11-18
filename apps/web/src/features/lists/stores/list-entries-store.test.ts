// @vitest-environment happy-dom
import type { ListEntryDetailResponse } from "@openrift/shared/types/api/list";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createListEntriesStore, useListEntriesStore } from "./list-entries-store";

function stubEntry(overrides: Partial<ListEntryDetailResponse> = {}): ListEntryDetailResponse {
  return {
    id: "entry-1",
    listId: "list-1",
    kind: "card",
    cardId: "card-1",
    cardName: "Card 1",
    quantity: 1,
    tradeOverride: {
      pricePref: null,
      priceAbsoluteCents: null,
      tradeType: null,
    },
    ...overrides,
  } as ListEntryDetailResponse;
}

describe("createListEntriesStore", () => {
  it("starts with empty maps", () => {
    const state = createListEntriesStore().getState();
    expect(state.entryByItemId.size).toBe(0);
    expect(state.entryByKey.size).toBe(0);
  });

  it("setEntries replaces both indexes atomically", () => {
    const entry = stubEntry();
    const byItem = new Map([["item-1", entry]]);
    const byKey = new Map([["card-1", entry]]);
    const store = createListEntriesStore();
    store.getState().setEntries(byItem, byKey, new Map());
    const state = store.getState();
    expect(state.entryByItemId.get("item-1")).toBe(entry);
    expect(state.entryByKey.get("card-1")).toBe(entry);
  });

  it("selectors return Object.is-equal refs across re-runs for unchanged entries", () => {
    const entry = stubEntry({ id: "stable-1" });
    const byItem = new Map([["item-1", entry]]);
    const byKey = new Map([["card-1", entry]]);
    const store = createListEntriesStore();
    store.getState().setEntries(byItem, byKey, new Map());
    const first = store.getState().entryByItemId.get("item-1");

    store
      .getState()
      .setEntries(new Map([["item-1", entry]]), new Map([["card-1", entry]]), new Map());
    const second = store.getState().entryByItemId.get("item-1");

    expect(second).toBe(first);
  });

  it("keeps each store's entries to itself", () => {
    const first = createListEntriesStore();
    first.getState().setEntries(new Map([["item-1", stubEntry()]]), new Map(), new Map());
    expect(createListEntriesStore().getState().entryByItemId.size).toBe(0);
  });
});

describe("useListEntriesStore", () => {
  it("throws outside a CollectionLayout", () => {
    expect(() => renderHook(() => useListEntriesStore((state) => state.entryByKey))).toThrow(
      "useListEntriesStore needs a CollectionLayout",
    );
  });
});
