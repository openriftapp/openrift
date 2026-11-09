import { describe, expect, it } from "vitest";

import {
  printingCopiesInZone,
  printingRemoveTarget,
} from "@/features/decks/lib/deck-printing-counts";

const unpinned = { preferredPrintingId: null, quantity: 1 };
const pinnedStandard = { preferredPrintingId: "standard", quantity: 1 };
const pinnedFoil = { preferredPrintingId: "foil", quantity: 2 };

describe("printingCopiesInZone", () => {
  it("adds unpinned copies to the default printing's pinned ones", () => {
    expect(printingCopiesInZone([unpinned, pinnedStandard], "standard", "standard")).toBe(2);
  });

  it("counts only pinned copies on any other printing", () => {
    expect(printingCopiesInZone([unpinned, pinnedFoil], "foil", "standard")).toBe(2);
    expect(printingCopiesInZone([unpinned, pinnedFoil], "japanese", "standard")).toBe(0);
  });

  it("drops unpinned copies when no default printing resolves", () => {
    expect(printingCopiesInZone([unpinned], "standard", undefined)).toBe(0);
  });
});

describe("printingRemoveTarget", () => {
  it("takes an unpinned copy first on the default row", () => {
    expect(printingRemoveTarget([unpinned, pinnedStandard], "standard", "standard")).toBeNull();
  });

  it("falls back to the pinned copy once no unpinned one is left", () => {
    expect(printingRemoveTarget([pinnedStandard], "standard", "standard")).toBe("standard");
  });

  it("takes the pinned copy on any other printing", () => {
    expect(printingRemoveTarget([unpinned, pinnedFoil], "foil", "standard")).toBe("foil");
  });

  it("finds nothing to remove on a row without copies", () => {
    expect(printingRemoveTarget([unpinned], "japanese", "standard")).toBeUndefined();
  });
});
