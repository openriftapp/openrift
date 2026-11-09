import { WellKnown } from "@openrift/shared/well-known";
import { describe, expect, it } from "vitest";

import {
  phoneZoneCardWidth,
  smallZoneGridStyles,
} from "@/features/decks/lib/deck-overview-geometry";

describe("smallZoneGridStyles", () => {
  it("gives runes its own row below four columns", () => {
    expect(smallZoneGridStyles(3).runes).toEqual({ gridColumn: "span 3 / span 3" });
  });

  it("shares row one from four columns up, leaving one card each side", () => {
    expect(smallZoneGridStyles(5).runes).toEqual({ gridColumn: "span 3 / span 3" });
    expect(smallZoneGridStyles(5).legend).toEqual({ gridColumn: "span 1 / span 1" });
    expect(smallZoneGridStyles(5).champion).toEqual({ gridColumn: "span 1 / span 1" });
  });

  it("gives battlefields a full-width band", () => {
    expect(smallZoneGridStyles(6).battlefield).toEqual({ gridColumn: "1 / -1" });
  });

  it("stacks every zone at the unmeasured single column", () => {
    const styles = smallZoneGridStyles(1);
    expect(styles.runes).toEqual({ gridColumn: "span 1 / span 1" });
    expect(styles.battlefield).toEqual({ gridColumn: "1 / -1" });
  });
});

describe("phoneZoneCardWidth", () => {
  it("fits four main-deck cards per row with the grid gap between them", () => {
    expect(phoneZoneCardWidth(WellKnown.deckZone.MAIN, 366)).toBe(87);
  });

  it("fits three legend and champion cards per row", () => {
    expect(phoneZoneCardWidth(WellKnown.deckZone.LEGEND, 366)).toBe(118);
    expect(phoneZoneCardWidth(WellKnown.deckZone.CHAMPION, 366)).toBe(118);
  });

  it("sizes battlefields so two rotated cards fill the row", () => {
    const width = phoneZoneCardWidth(WellKnown.deckZone.BATTLEFIELD, 366);
    expect(width).toBe(128);
    expect(2 * ((width * 88) / 63) + 6).toBeLessThanOrEqual(366);
  });

  it("takes a different per-row count for the other portrait zones", () => {
    expect(phoneZoneCardWidth(WellKnown.deckZone.MAIN, 366, 3)).toBe(118);
    expect(phoneZoneCardWidth(WellKnown.deckZone.BATTLEFIELD, 366, 3)).toBe(128);
  });

  it("never returns a negative width for a collapsed container", () => {
    expect(phoneZoneCardWidth(WellKnown.deckZone.MAIN, 0)).toBe(0);
  });
});
