import { describe, expect, it } from "vitest";

import { snapshotHeadline } from "./pricing";

describe("snapshotHeadline", () => {
  it("returns market for TCGplayer snapshots", () => {
    expect(snapshotHeadline({ date: "2026-04-01", market: 4.52, low: 3.25 })).toBe(4.52);
  });

  it("returns market for Cardmarket snapshots", () => {
    expect(snapshotHeadline({ date: "2026-04-01", market: 3.8, low: 2.5 })).toBe(3.8);
  });

  it("returns zeroLow for CardTrader when present — the Zero-eligible price is the headline", () => {
    expect(snapshotHeadline({ date: "2026-04-01", zeroLow: 4.2, low: 3.9 })).toBe(4.2);
  });

  it("falls back to overall low for CardTrader when zeroLow is null", () => {
    expect(snapshotHeadline({ date: "2026-04-01", zeroLow: null, low: 3.9 })).toBe(3.9);
  });

  it("returns zeroLow for CardTrader when low is null (all sellers are Zero-eligible)", () => {
    expect(snapshotHeadline({ date: "2026-04-01", zeroLow: 4.2, low: null })).toBe(4.2);
  });
});
