// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { layoutStoresWrapper } from "@/test/collection-layout-stores";
import { stubPrinting } from "@/test/factories";

import type { DragPreviewStore } from "./drag-preview-store";
import { createDragPreviewStore, useDragPreviewStore } from "./drag-preview-store";

let store: DragPreviewStore;

beforeEach(() => {
  store = createDragPreviewStore();
});

describe("createDragPreviewStore", () => {
  it("starts empty with a default noun", () => {
    const state = store.getState();
    expect(state.preview).toEqual([]);
    expect(state.selectionCount).toBe(0);
    expect(state.selectionNoun).toBe("printing");
  });

  it("setPreview replaces the fan, count, and noun together", () => {
    const a = stubPrinting();
    const b = stubPrinting();
    store.getState().setPreview([a, b], 5, "printing");
    const state = store.getState();
    expect(state.preview).toEqual([a, b]);
    expect(state.selectionCount).toBe(5);
    expect(state.selectionNoun).toBe("printing");
  });

  it("setPreview with an empty list clears the preview", () => {
    const a = stubPrinting();
    store.getState().setPreview([a], 3, "card");
    store.getState().setPreview([], 0, "card");
    expect(store.getState().preview).toEqual([]);
    expect(store.getState().selectionCount).toBe(0);
  });

  it("setting the same preview content swaps the array reference but matches by content", () => {
    const a = stubPrinting();
    store.getState().setPreview([a], 1, "copy");
    const first = store.getState().preview;
    store.getState().setPreview([a], 1, "copy");
    const second = store.getState().preview;
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });

  it("keeps each store's preview to itself", () => {
    store.getState().setPreview([stubPrinting()], 1, "copy");
    expect(createDragPreviewStore().getState().preview).toEqual([]);
  });
});

describe("useDragPreviewStore", () => {
  it("reads the preview of the enclosing layout", () => {
    const first = renderHook(() => useDragPreviewStore((state) => state.selectionCount), {
      wrapper: layoutStoresWrapper({ dragPreview: store }),
    });
    const other = renderHook(() => useDragPreviewStore((state) => state.selectionCount), {
      wrapper: layoutStoresWrapper(),
    });

    act(() => store.getState().setPreview([stubPrinting()], 4, "card"));

    expect(first.result.current).toBe(4);
    expect(other.result.current).toBe(0);
  });

  it("throws outside a CollectionLayout", () => {
    expect(() => renderHook(() => useDragPreviewStore((state) => state.preview))).toThrow(
      "useDragPreviewStore needs a CollectionLayout",
    );
  });
});
