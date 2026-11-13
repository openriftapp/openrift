import { HOUR_MS } from "@openrift/shared/format-date";
import { describe, expect, it } from "vitest";

import { isStaleRecord, listingPriceCents, SOURCE_CONFIGS } from "./marketplace-sources";

describe("listingPriceCents", () => {
  it("shows the price players see on each marketplace", () => {
    expect(
      listingPriceCents("tcgplayer", { marketCents: 450, lowCents: 300, zeroLowCents: null }),
    ).toBe(450);
    expect(
      listingPriceCents("cardmarket", { marketCents: 450, lowCents: 300, zeroLowCents: null }),
    ).toBe(300);
    expect(
      listingPriceCents("cardmarket", { marketCents: 450, lowCents: null, zeroLowCents: null }),
    ).toBe(450);
  });

  it("shows the hub-seller low, then low, where that is the headline", () => {
    expect(
      listingPriceCents("cardtrader", { marketCents: null, lowCents: 90, zeroLowCents: 120 }),
    ).toBe(120);
    expect(
      listingPriceCents("cardtrader", { marketCents: null, lowCents: 90, zeroLowCents: null }),
    ).toBe(90);
  });

  it("is null when nothing positive is set", () => {
    expect(
      listingPriceCents("cardnexus", { marketCents: null, lowCents: 0, zeroLowCents: null }),
    ).toBeNull();
    expect(
      listingPriceCents("tcgplayer", { marketCents: null, lowCents: null, zeroLowCents: null }),
    ).toBeNull();
  });
});

describe("isStaleRecord", () => {
  const now = new Date("2026-03-10T12:00:00Z").getTime();

  it("flags a record last seen over two days ago", () => {
    expect(isStaleRecord(new Date(now - 49 * HOUR_MS), now)).toBe(true);
    expect(isStaleRecord(new Date(now - 47 * HOUR_MS), now)).toBe(false);
  });
});

describe("SOURCE_CONFIGS", () => {
  it("links every marketplace's products to its own site", () => {
    for (const [marketplace, config] of Object.entries(SOURCE_CONFIGS)) {
      expect(config.source).toBe(marketplace);
    }
  });
});
