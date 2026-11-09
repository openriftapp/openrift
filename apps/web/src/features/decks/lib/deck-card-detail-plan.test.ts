import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { describe, expect, it } from "vitest";

import {
  deckDetailControlsApply,
  deckPrintingStock,
  planDeckCardDetail,
} from "./deck-card-detail-plan";

const MAIN = WellKnown.deckZone.MAIN;
const SIDEBOARD = WellKnown.deckZone.SIDEBOARD;
const OVERFLOW = WellKnown.deckZone.OVERFLOW;

function entry(zone: DeckZone, preferredPrintingId: string | null, quantity: number) {
  return { zone, preferredPrintingId, quantity };
}

function plan(overrides: Partial<Parameters<typeof planDeckCardDetail>[0]> = {}) {
  return planDeckCardDetail({
    cardEntries: [],
    activeZone: MAIN,
    detailZone: MAIN,
    zoneSwitchable: true,
    defaultPrintingId: "p-default",
    rowPrintingIds: new Set(["p-default", "p-foil"]),
    activeZoneFull: false,
    copyLimitReached: false,
    isFreeform: false,
    ...overrides,
  });
}

describe("deckDetailControlsApply", () => {
  it("applies to multi-copy zones in the workbench", () => {
    expect(
      deckDetailControlsApply({ workbench: true, isSingleCardZone: false, activeZone: MAIN }),
    ).toBe(true);
  });

  it("does not apply outside the workbench or to single-slot zones", () => {
    expect(
      deckDetailControlsApply({ workbench: false, isSingleCardZone: false, activeZone: MAIN }),
    ).toBe(false);
    expect(
      deckDetailControlsApply({ workbench: true, isSingleCardZone: true, activeZone: MAIN }),
    ).toBe(false);
  });

  it("does not apply to battlefields or legend options", () => {
    for (const activeZone of [WellKnown.deckZone.BATTLEFIELD, WellKnown.deckZone.LEGEND_OPTIONS]) {
      expect(
        deckDetailControlsApply({ workbench: true, isSingleCardZone: false, activeZone }),
      ).toBe(false);
    }
  });
});

describe("planDeckCardDetail", () => {
  it("counts main and sideboard copies for the zone toggle", () => {
    const result = plan({
      cardEntries: [entry(MAIN, null, 2), entry(MAIN, "p-foil", 1), entry(SIDEBOARD, null, 1)],
    });
    expect(result.zones).toEqual([
      { zone: MAIN, count: 3 },
      { zone: SIDEBOARD, count: 1 },
    ]);
  });

  it("has no zone toggle when the zone can't switch", () => {
    expect(plan({ zoneSwitchable: false }).zones).toBeUndefined();
  });

  it("adds to the default row unpinned and to other rows pinned", () => {
    const result = plan();
    expect(result.row("p-default")).toMatchObject({ isDefault: true, addPrintingId: null });
    expect(result.row("p-foil")).toMatchObject({ isDefault: false, addPrintingId: "p-foil" });
  });

  it("counts and removes copies from the shown zone only", () => {
    const result = plan({
      detailZone: SIDEBOARD,
      cardEntries: [entry(MAIN, "p-foil", 3), entry(SIDEBOARD, "p-foil", 1)],
    });
    expect(result.row("p-foil")).toMatchObject({ copies: 1, removeTarget: "p-foil" });
    expect(result.row("p-default")).toMatchObject({ copies: 0, removeTarget: undefined });
  });

  it("lists copies in zones outside the toggle as loose entries", () => {
    const overflow = entry(OVERFLOW, null, 2);
    const result = plan({ cardEntries: [entry(MAIN, null, 1), overflow] });
    expect(result.looseEntries).toEqual([overflow]);
  });

  it("lists copies whose printing has no row as loose entries", () => {
    const missingPin = entry(MAIN, "p-gone", 1);
    const result = plan({ cardEntries: [entry(MAIN, "p-foil", 1), missingPin] });
    expect(result.looseEntries).toEqual([missingPin]);
  });

  it("lists unpinned copies as loose when no default printing resolves", () => {
    const unpinned = entry(MAIN, null, 2);
    const result = plan({ defaultPrintingId: undefined, cardEntries: [unpinned] });
    expect(result.looseEntries).toEqual([unpinned]);
  });

  it("limits adds in the active zone by the zone's capacity", () => {
    expect(plan({ activeZoneFull: true }).canAdd).toBe(false);
    expect(plan({ activeZoneFull: false, copyLimitReached: true }).canAdd).toBe(true);
  });

  it("limits adds in the other zone by the card's copy limit", () => {
    const other = { activeZone: MAIN, detailZone: SIDEBOARD };
    expect(plan({ ...other, activeZoneFull: true }).canAdd).toBe(true);
    expect(plan({ ...other, copyLimitReached: true }).canAdd).toBe(false);
    expect(plan({ ...other, copyLimitReached: true, isFreeform: true }).canAdd).toBe(true);
  });

  it("leaves a row without a note when available copies cover it", () => {
    const result = plan({
      cardEntries: [entry(MAIN, "p-foil", 2)],
      stock: { available: { "p-foil": 2 }, excluded: {}, lent: {} },
    });
    expect(result.row("p-foil").uncovered).toBeUndefined();
  });

  it("splits uncovered copies into excluded, lent and not owned", () => {
    const result = plan({
      cardEntries: [entry(MAIN, "p-foil", 4)],
      stock: { available: { "p-foil": 1 }, excluded: { "p-foil": 1 }, lent: { "p-foil": 1 } },
    });
    expect(result.row("p-foil").uncovered).toEqual({ excluded: 1, lent: 1, notOwned: 1 });
  });

  it("has no note without stock data", () => {
    const result = plan({ cardEntries: [entry(MAIN, "p-foil", 1)] });
    expect(result.row("p-foil").uncovered).toBeUndefined();
  });
});

describe("deckPrintingStock", () => {
  const counts = {
    available: { a: 1 },
    lockedExcluded: { a: 2 },
    lockedLoaned: { a: 1 },
    lockedReserved: { b: 1 },
  };

  it("keeps excluded copies apart and pools loaned with reserved", () => {
    expect(deckPrintingStock(counts, false)).toEqual({
      available: { a: 1 },
      excluded: { a: 2 },
      lent: { a: 1, b: 1 },
    });
  });

  it("counts excluded copies as available when the setting says so", () => {
    expect(deckPrintingStock(counts, true)).toMatchObject({ available: { a: 3 }, excluded: {} });
  });
});
