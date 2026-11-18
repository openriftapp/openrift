import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { stubDeckBuilderCard, stubPrinting } from "@/test/factories";

const standard = stubPrinting({ printingId: "print-a", cardId: "card-a", language: "EN" });
const printingsByCardId = new Map([["card-a", [standard]]]);
let catalogLoaded = true;
let copiesLoaded = true;
let requested: { enabled: boolean; exempt?: string | null } | undefined;

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCardsOnDemand: (enabled: boolean) =>
    enabled && catalogLoaded ? { printingsByCardId } : undefined,
}));
vi.mock("@/features/collections/hooks/use-owned-count", () => ({
  useDeckBuildingCounts: (enabled: boolean, exempt?: string | null) => {
    requested = { enabled, exempt };
    return {
      data:
        enabled && copiesLoaded
          ? { available: { "print-a": 2 }, locked: { "print-a": 1 } }
          : undefined,
    };
  },
}));
vi.mock("@/features/groups/hooks/use-loans", () => ({
  useBorrowedCounts: () => ({ data: { "print-a": 1 } }),
}));
vi.mock("@/hooks/use-effective-language-order", () => ({
  useEffectiveLanguageOrder: () => ["EN"],
}));

import { useOwnershipBandSources } from "./use-ownership-band-sources";

const card = stubDeckBuilderCard({ cardId: "card-a", quantity: 3 });

function renderSources(enabled = true) {
  return renderHook(() =>
    useOwnershipBandSources([card], { enabled, homeCollectionId: "home-box" }),
  ).result;
}

describe("useOwnershipBandSources", () => {
  beforeEach(() => {
    catalogLoaded = true;
    copiesLoaded = true;
    requested = undefined;
  });

  it("collects available, locked and borrowed copies per card, exempting the home collection", () => {
    const result = renderSources();
    expect(result.current?.availableByCardId).toEqual({ "card-a": 2 });
    expect(result.current?.lockedByCardId).toEqual({ "card-a": 1 });
    expect(result.current?.borrowedByCardId).toEqual({ "card-a": 1 });
    expect(Object.values(result.current?.displayedPrintingIdByCardKey ?? {})).toEqual(["print-a"]);
    expect(requested).toEqual({ enabled: true, exempt: "home-box" });
  });

  it("stays undefined until the copies arrive", () => {
    copiesLoaded = false;
    expect(renderSources().current).toBeUndefined();
  });

  it("stays undefined while the catalogue is loading", () => {
    catalogLoaded = false;
    expect(renderSources().current).toBeUndefined();
  });

  it("stays undefined and leaves the copies unsubscribed while disabled", () => {
    expect(renderSources(false).current).toBeUndefined();
    expect(requested?.enabled).toBe(false);
  });
});
