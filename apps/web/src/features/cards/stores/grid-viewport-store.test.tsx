import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  createGridViewportStore,
  GridViewportStoreContext,
  useGridViewportStore,
} from "@/features/cards/stores/grid-viewport-store";

describe("createGridViewportStore", () => {
  it("starts on the SSR-safe default", () => {
    expect(createGridViewportStore().getState().autoColumns).toBe(5);
  });

  it("publishes a new measurement", () => {
    const store = createGridViewportStore();
    store.getState().setAutoColumns(6);
    expect(store.getState().autoColumns).toBe(6);
  });

  it("does not notify subscribers when the measurement is unchanged", () => {
    // ResizeObserver fires on scrollbar-width changes too, so an identical
    // re-publish is common; the toolbar controls shouldn't re-render for it.
    const store = createGridViewportStore();
    store.getState().setAutoColumns(4);

    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.getState().setAutoColumns(4);
    unsubscribe();

    expect(listener).not.toHaveBeenCalled();
  });

  it("notifies when the measurement moves", () => {
    const store = createGridViewportStore();
    store.getState().setAutoColumns(4);

    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.getState().setAutoColumns(5);
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().autoColumns).toBe(5);
  });

  it("keeps each store's measurement to itself", () => {
    const first = createGridViewportStore();
    first.getState().setAutoColumns(8);

    expect(createGridViewportStore().getState().autoColumns).toBe(5);
  });
});

describe("useGridViewportStore", () => {
  it("reads the store from the nearest provider", () => {
    const store = createGridViewportStore();
    store.getState().setAutoColumns(7);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <GridViewportStoreContext value={store}>{children}</GridViewportStoreContext>
    );
    const { result } = renderHook(() => useGridViewportStore((state) => state.autoColumns), {
      wrapper,
    });
    expect(result.current).toBe(7);
  });

  it("throws without a provider", () => {
    expect(() => renderHook(() => useGridViewportStore((state) => state.autoColumns))).toThrow(
      "useGridViewportStore needs a CardBrowserLayout",
    );
  });
});
