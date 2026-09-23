import { describe, expect, it } from "vitest";

import { isCountedZone, isZoneShown, zoneExpected } from "./deck-zones.js";
import { WellKnown } from "./well-known.js";

describe("isCountedZone", () => {
  it("counts every zone of the deck proper", () => {
    expect(isCountedZone(WellKnown.deckZone.LEGEND)).toBe(true);
    expect(isCountedZone(WellKnown.deckZone.CHAMPION)).toBe(true);
    expect(isCountedZone(WellKnown.deckZone.RUNES)).toBe(true);
    expect(isCountedZone(WellKnown.deckZone.BATTLEFIELD)).toBe(true);
    expect(isCountedZone(WellKnown.deckZone.MAIN)).toBe(true);
    expect(isCountedZone(WellKnown.deckZone.SIDEBOARD)).toBe(true);
  });

  it("leaves out the overflow parking zone", () => {
    expect(isCountedZone(WellKnown.deckZone.OVERFLOW)).toBe(false);
  });

  it("counts an unrecognized zone rather than dropping its cards", () => {
    expect(isCountedZone("not-a-zone")).toBe(true);
  });
});

const neeko = { zone: WellKnown.deckZone.MAIN, quantity: 1, additionalLegendCount: 3 };
const option = { zone: WellKnown.deckZone.LEGEND_OPTIONS, quantity: 1 };

describe("isZoneShown", () => {
  it("shows the zones every deck has", () => {
    expect(isZoneShown(WellKnown.deckZone.MAIN, "constructed", [])).toBe(true);
    expect(isZoneShown(WellKnown.deckZone.OVERFLOW, "custom-region", [])).toBe(true);
  });

  it("hides an empty sideboard only in formats without one", () => {
    expect(isZoneShown(WellKnown.deckZone.SIDEBOARD, "constructed", [])).toBe(true);
    expect(isZoneShown(WellKnown.deckZone.SIDEBOARD, "custom-region", [])).toBe(false);
    expect(
      isZoneShown(WellKnown.deckZone.SIDEBOARD, "custom-region", [
        { zone: WellKnown.deckZone.SIDEBOARD, quantity: 1 },
      ]),
    ).toBe(true);
  });

  it("shows legend options once a card grants extra legends", () => {
    expect(isZoneShown(WellKnown.deckZone.LEGEND_OPTIONS, "constructed", [])).toBe(false);
    expect(isZoneShown(WellKnown.deckZone.LEGEND_OPTIONS, "constructed", [neeko])).toBe(true);
  });

  it("keeps legend options visible while they hold cards, even without a granting card", () => {
    expect(isZoneShown(WellKnown.deckZone.LEGEND_OPTIONS, "constructed", [option])).toBe(true);
  });

  it("does not count a granting card parked in the sideboard", () => {
    expect(
      isZoneShown(WellKnown.deckZone.LEGEND_OPTIONS, "constructed", [
        { ...neeko, zone: WellKnown.deckZone.SIDEBOARD },
      ]),
    ).toBe(false);
  });
});

describe("zoneExpected", () => {
  it("targets as many legend options as the deck grants", () => {
    expect(zoneExpected(WellKnown.deckZone.LEGEND_OPTIONS, "constructed", [neeko])).toBe(3);
  });

  it("has no legend options target without a granting card or without cards", () => {
    expect(
      zoneExpected(WellKnown.deckZone.LEGEND_OPTIONS, "constructed", [option]),
    ).toBeUndefined();
    expect(zoneExpected(WellKnown.deckZone.LEGEND_OPTIONS, "constructed")).toBeUndefined();
  });
});
