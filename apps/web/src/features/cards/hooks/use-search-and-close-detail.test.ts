import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSelectionStore } from "@/stores/selection-store";
import { createStoreResetter } from "@/test/store-helpers";

import { useSearchAndCloseDetail } from "./use-search-and-close-detail";

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => mobile.value }));

const resetSelectionStore = createStoreResetter(useSelectionStore);

beforeEach(() => {
  mobile.value = false;
  useSelectionStore.setState({ detailOpen: true });
});

afterEach(() => {
  resetSelectionStore();
});

describe("useSearchAndCloseDetail", () => {
  it("sets the search and keeps the detail open on wide screens", () => {
    const setSearch = vi.fn();
    const search = renderHook(() => useSearchAndCloseDetail(setSearch)).result.current;

    search("Jinx");

    expect(setSearch).toHaveBeenCalledWith("Jinx");
    expect(useSelectionStore.getState().detailOpen).toBe(true);
  });

  it("closes the detail on phones", () => {
    mobile.value = true;
    const setSearch = vi.fn();
    const search = renderHook(() => useSearchAndCloseDetail(setSearch)).result.current;

    search("Jinx");

    expect(setSearch).toHaveBeenCalledWith("Jinx");
    expect(useSelectionStore.getState().detailOpen).toBe(false);
  });
});
