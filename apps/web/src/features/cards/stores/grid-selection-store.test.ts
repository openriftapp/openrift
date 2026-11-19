// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { layoutStoresWrapper } from "@/test/collection-layout-stores";

import type { GridSelectionStore } from "./grid-selection-store";
import { createGridSelectionStore, useGridSelectionStore } from "./grid-selection-store";

let store: GridSelectionStore;

beforeEach(() => {
  store = createGridSelectionStore();
});

describe("createGridSelectionStore", () => {
  describe("toggleSelect", () => {
    it("adds an unselected copy to the selection", () => {
      store.getState().toggleSelect("copy-1");
      expect(store.getState().selected).toEqual(new Set(["copy-1"]));
    });

    it("removes an already-selected copy", () => {
      store.getState().toggleSelect("copy-1");
      store.getState().toggleSelect("copy-1");
      expect(store.getState().selected.size).toBe(0);
    });
  });

  describe("toggleStack", () => {
    it("selects all ids in the stack when none are selected", () => {
      store.getState().toggleStack(["copy-1", "copy-2"]);
      expect(store.getState().selected).toEqual(new Set(["copy-1", "copy-2"]));
    });

    it("deselects all ids in the stack when all are selected", () => {
      store.getState().toggleStack(["copy-1", "copy-2"]);
      store.getState().toggleStack(["copy-1", "copy-2"]);
      expect(store.getState().selected.size).toBe(0);
    });

    it("selects the remaining ids when only some are selected", () => {
      store.getState().toggleSelect("copy-1");
      store.getState().toggleStack(["copy-1", "copy-2"]);
      expect(store.getState().selected).toEqual(new Set(["copy-1", "copy-2"]));
    });

    it("does nothing for an empty array", () => {
      const before = store.getState();
      store.getState().toggleStack([]);
      expect(store.getState()).toBe(before);
    });
  });

  describe("toggleSelectAll", () => {
    it("selects all given ids when nothing is selected", () => {
      store.getState().toggleSelectAll(["copy-1", "copy-2", "copy-3"]);
      expect(store.getState().selected).toEqual(new Set(["copy-1", "copy-2", "copy-3"]));
    });

    it("clears selection when the full set is already selected", () => {
      store.getState().toggleSelectAll(["copy-1", "copy-2"]);
      store.getState().toggleSelectAll(["copy-1", "copy-2"]);
      expect(store.getState().selected.size).toBe(0);
    });

    it("re-selects all when sizes match but ids differ (size-only comparison)", () => {
      store.getState().toggleSelect("copy-1");
      store.getState().toggleSelectAll(["copy-2"]);
      expect(store.getState().selected).toEqual(new Set());
    });

    it("selects nothing for an empty list", () => {
      store.getState().toggleSelectAll([]);
      expect(store.getState().selected.size).toBe(0);
    });
  });

  describe("addToSelection", () => {
    it("adds new ids to an existing selection", () => {
      store.getState().toggleSelect("copy-1");
      store.getState().addToSelection(["copy-2", "copy-3"]);
      expect(store.getState().selected).toEqual(new Set(["copy-1", "copy-2", "copy-3"]));
    });

    it("is idempotent for already-selected ids", () => {
      store.getState().toggleSelect("copy-1");
      store.getState().addToSelection(["copy-1"]);
      expect(store.getState().selected).toEqual(new Set(["copy-1"]));
    });

    it("does nothing for an empty array", () => {
      const before = store.getState();
      store.getState().addToSelection([]);
      expect(store.getState()).toBe(before);
    });
  });

  describe("clearSelection", () => {
    it("empties the selection", () => {
      store.getState().addToSelection(["copy-1", "copy-2"]);
      store.getState().clearSelection();
      expect(store.getState().selected.size).toBe(0);
    });

    it("is a no-op result when the selection is already empty", () => {
      store.getState().clearSelection();
      expect(store.getState().selected.size).toBe(0);
    });
  });

  it("keeps each store's selection to itself", () => {
    store.getState().toggleSelect("copy-1");
    expect(createGridSelectionStore().getState().selected.size).toBe(0);
  });
});

describe("useGridSelectionStore", () => {
  it("reads the selection of the enclosing layout", () => {
    const first = renderHook(() => useGridSelectionStore((state) => state.selected.size), {
      wrapper: layoutStoresWrapper({ gridSelection: store }),
    });
    const other = renderHook(() => useGridSelectionStore((state) => state.selected.size), {
      wrapper: layoutStoresWrapper(),
    });

    act(() => store.getState().addToSelection(["copy-1", "copy-2"]));

    expect(first.result.current).toBe(2);
    expect(other.result.current).toBe(0);
  });

  it("throws outside a CollectionLayout", () => {
    expect(() => renderHook(() => useGridSelectionStore((state) => state.selected))).toThrow(
      "useGridSelectionStore needs a CollectionLayout",
    );
  });
});
