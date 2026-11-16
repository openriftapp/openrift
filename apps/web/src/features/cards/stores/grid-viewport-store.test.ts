import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useGridViewportStore } from "@/features/cards/stores/grid-viewport-store";
import { createStoreResetter } from "@/test/store-helpers";

const reset = createStoreResetter(useGridViewportStore);

beforeEach(() => {
  reset();
});

afterEach(() => {
  reset();
});

describe("useGridViewportStore", () => {
  it("starts on the SSR-safe default", () => {
    expect(useGridViewportStore.getState().autoColumns).toBe(5);
  });

  it("publishes a new measurement", () => {
    useGridViewportStore.getState().setAutoColumns(6);
    expect(useGridViewportStore.getState().autoColumns).toBe(6);
  });

  it("does not notify subscribers when the measurement is unchanged", () => {
    // ResizeObserver fires on scrollbar-width changes too, so an identical
    // re-publish is common; the toolbar controls shouldn't re-render for it.
    useGridViewportStore.getState().setAutoColumns(4);

    const listener = vi.fn();
    const unsubscribe = useGridViewportStore.subscribe(listener);
    useGridViewportStore.getState().setAutoColumns(4);
    unsubscribe();

    expect(listener).not.toHaveBeenCalled();
  });

  it("notifies when the measurement moves", () => {
    useGridViewportStore.getState().setAutoColumns(4);

    const listener = vi.fn();
    const unsubscribe = useGridViewportStore.subscribe(listener);
    useGridViewportStore.getState().setAutoColumns(5);
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(useGridViewportStore.getState().autoColumns).toBe(5);
  });
});
