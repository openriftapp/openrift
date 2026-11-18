import type { Printing } from "@openrift/shared/types/catalog";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { stubPrinting } from "@/test/factories";
import { rowActionsWrapper } from "@/test/row-actions";

import {
  createCardRowActionsStore,
  useCardRowDispatch,
  useQuantityPending,
} from "./card-row-actions-store";

const printing = { printingId: "p1" } as Printing;

describe("createCardRowActionsStore", () => {
  it("starts with no handlers registered", () => {
    expect(createCardRowActionsStore().getState().handlers).toEqual({});
  });

  it("setHandlers replaces (not merges) prior handlers", () => {
    const store = createCardRowActionsStore();
    const second = vi.fn();
    store.getState().setHandlers({ onRowClick: vi.fn() });
    store.getState().setHandlers({ onIncrement: second });

    expect(store.getState().handlers.onRowClick).toBeUndefined();
    store.getState().dispatch.dispatchIncrement(printing);
    expect(second).toHaveBeenCalledWith(printing, undefined);
  });

  it("keeps one dispatch object across handler swaps", () => {
    const store = createCardRowActionsStore();
    const { dispatch } = store.getState();
    store.getState().setHandlers({ onRowClick: vi.fn() });
    expect(store.getState().dispatch).toBe(dispatch);
  });

  it("keeps each store's handlers to itself", () => {
    const catalog = createCardRowActionsStore();
    const list = createCardRowActionsStore();
    const catalogClick = vi.fn();
    const listClick = vi.fn();
    catalog.getState().setHandlers({ onRowClick: catalogClick });
    list.getState().setHandlers({ onRowClick: listClick });

    list.getState().dispatch.dispatchRowClick(printing);

    expect(listClick).toHaveBeenCalledWith(printing);
    expect(catalogClick).not.toHaveBeenCalled();
  });

  it("forwards the row's item id from a table row click", () => {
    const store = createCardRowActionsStore();
    const onRowClick = vi.fn();
    store.getState().setHandlers({ onRowClick });
    store.getState().dispatch.dispatchTableRowClick(printing, "item-2");
    expect(onRowClick).toHaveBeenCalledWith(printing, "item-2");
  });

  it("dispatchContextAction forwards the displayed printing for printing-scoped actions", () => {
    const store = createCardRowActionsStore();
    const onContextAction = vi.fn();
    store.getState().setHandlers({ onContextAction });
    const foilPrinting = stubPrinting({ printingId: "p-foil" });
    store.getState().dispatch.dispatchContextAction("item-1", "lend", foilPrinting);
    expect(onContextAction).toHaveBeenCalledWith("item-1", "lend", foilPrinting);
  });

  it("dispatchDropFromRule forwards the target to the registered handler", () => {
    const store = createCardRowActionsStore();
    const onDropFromRule = vi.fn();
    store.getState().setHandlers({ onDropFromRule });
    store.getState().dispatch.dispatchDropFromRule({ kind: "card", cardId: "card-1" });
    expect(onDropFromRule).toHaveBeenCalledWith({ kind: "card", cardId: "card-1" });
  });

  it("dispatchMoveCopyToCollection forwards the copy id to the registered handler", () => {
    const store = createCardRowActionsStore();
    const onMoveCopyToCollection = vi.fn();
    store.getState().setHandlers({ onMoveCopyToCollection });
    store.getState().dispatch.dispatchMoveCopyToCollection("copy-1");
    expect(onMoveCopyToCollection).toHaveBeenCalledWith("copy-1");
  });

  it("is a no-op when the surface registered no handler", () => {
    const { dispatch } = createCardRowActionsStore().getState();
    expect(() => {
      dispatch.dispatchContextAction("item-1", "move");
      dispatch.dispatchDropFromRule({ kind: "copy", copyId: "copy-1" });
      dispatch.dispatchMoveCopyToCollection("copy-1");
    }).not.toThrow();
  });
});

describe("useCardRowDispatch", () => {
  it("returns the dispatch object of the enclosing surface", () => {
    const store = createCardRowActionsStore();
    const { result } = renderHook(() => useCardRowDispatch(), {
      wrapper: rowActionsWrapper(store),
    });
    expect(result.current).toBe(store.getState().dispatch);
  });

  it("throws outside a card surface", () => {
    expect(() => renderHook(() => useCardRowDispatch())).toThrow(
      "card row actions need a CardRowActionsStoreContext",
    );
  });
});

describe("useQuantityPending", () => {
  it("re-renders when the registered pending state for the entry settles", () => {
    const store = createCardRowActionsStore();
    let pendingId: string | null = "e1";
    const register = () =>
      store.getState().setHandlers({ isQuantityPendingFor: (entryId) => entryId === pendingId });
    register();
    const { result } = renderHook(() => useQuantityPending("e1"), {
      wrapper: rowActionsWrapper(store),
    });
    expect(result.current).toBe(true);

    pendingId = null;
    act(register);

    expect(result.current).toBe(false);
  });

  it("is false for an entry without a row and when the list registered nothing", () => {
    const wrapper = rowActionsWrapper(createCardRowActionsStore());
    expect(renderHook(() => useQuantityPending(null), { wrapper }).result.current).toBe(false);
    expect(renderHook(() => useQuantityPending("e1"), { wrapper }).result.current).toBe(false);
  });
});
