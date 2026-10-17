import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useFilterDrawerStore } from "@/features/cards/stores/filter-drawer-store";
import { createStoreResetter } from "@/test/store-helpers";

const smUp = vi.hoisted(() => ({ value: false }));
vi.mock("@/hooks/use-sm-up", () => ({ useSmUp: () => smUp.value }));

const { useFilterCountsVisible } = await import("./use-filter-counts-visible");

const resetStore = createStoreResetter(useFilterDrawerStore);

afterEach(() => {
  resetStore();
  smUp.value = false;
});

describe("useFilterCountsVisible", () => {
  it("hides counts on phones while the drawer is closed", () => {
    const { result } = renderHook(() => useFilterCountsVisible());
    expect(result.current).toBe(false);
  });

  it("shows counts on phones once the drawer opens", () => {
    const { result } = renderHook(() => useFilterCountsVisible());
    act(() => useFilterDrawerStore.getState().setOpen(true, "/cards"));
    expect(result.current).toBe(true);
  });

  it("always shows counts from sm up", () => {
    smUp.value = true;
    const { result } = renderHook(() => useFilterCountsVisible());
    expect(result.current).toBe(true);
  });
});
