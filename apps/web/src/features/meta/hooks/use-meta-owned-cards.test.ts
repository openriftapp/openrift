import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const printingsByCardId = new Map([["card-a", [{ printingId: "print-a" }]]]);
let catalogLoaded = true;
let stockLoaded = true;
let requestedEnabled: boolean | undefined;

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCatalogOnDemand: () => ({ catalog: catalogLoaded ? { printingsByCardId } : undefined }),
}));
vi.mock("@/features/meta/hooks/use-buildable-count", () => ({
  useBuildableCount: (enabled: boolean) => {
    requestedEnabled = enabled;
    return {
      data: stockLoaded ? { buildable: { "print-a": 2 }, locked: { "print-a": 1 } } : undefined,
    };
  },
}));

import { useMetaOwnedCards } from "./use-meta-owned-cards";

describe("useMetaOwnedCards", () => {
  beforeEach(() => {
    catalogLoaded = true;
    stockLoaded = true;
    requestedEnabled = undefined;
  });

  it("pairs the buildable and locked copies with the catalogue's printings", () => {
    const { result } = renderHook(() => useMetaOwnedCards(true));
    expect(result.current).toEqual({
      ownedByPrinting: { "print-a": 2 },
      lockedByPrinting: { "print-a": 1 },
      printingsByCardId,
    });
  });

  it("stays undefined until the copies arrive, so nothing reads as unowned early", () => {
    stockLoaded = false;
    const { result } = renderHook(() => useMetaOwnedCards(true));
    expect(result.current).toBeUndefined();
  });

  it("stays undefined while the catalogue is loading", () => {
    catalogLoaded = false;
    const { result } = renderHook(() => useMetaOwnedCards(true));
    expect(result.current).toBeUndefined();
  });

  it("stays undefined and leaves the copies unsubscribed while disabled", () => {
    const { result } = renderHook(() => useMetaOwnedCards(false));
    expect(result.current).toBeUndefined();
    expect(requestedEnabled).toBe(false);
  });
});
