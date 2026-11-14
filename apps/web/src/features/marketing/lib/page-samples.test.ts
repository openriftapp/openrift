import type { LandingSummaryResponse } from "@openrift/shared/types/api/catalog";
import { describe, expect, it } from "vitest";

import { featuresSamples, landingSamples } from "./page-samples";

function thumbnail(index: number): LandingSummaryResponse["thumbnails"][number] {
  return {
    imageId: `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`,
    rarity: "common",
    domains: ["fury"],
    name: `Card ${index}`,
    shortCode: `OGN-${String(index).padStart(3, "0")}`,
    variantLabel: null,
    priceCents: 100,
  };
}

function summary(count: number): LandingSummaryResponse {
  const thumbnails = Array.from({ length: count }, (_, index) => thumbnail(index));
  return {
    cardCount: 1,
    printingCount: 1,
    copyCount: 1,
    thumbnailIds: thumbnails.map((thumb) => thumb.imageId),
    thumbnails,
    legendThumbnailIds: [],
    promoSections: [],
  };
}

function allUrls(samples: Record<string, unknown>): string[] {
  return Object.entries(samples)
    .filter(([key]) => key !== "catalogCards")
    .flatMap(([, value]) => {
      const items = Array.isArray(value) ? value : value === undefined ? [] : [value];
      return items.map((item) => (typeof item === "string" ? item : (item as { url: string }).url));
    });
}

describe("featuresSamples", () => {
  it("never shows one card in two sections", () => {
    const urls = allUrls({ ...featuresSamples(summary(36), { scanner: true }) });
    expect(urls).toHaveLength(36);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("leaves the scanner its cards only while the scanner is on", () => {
    expect(featuresSamples(summary(36), { scanner: false }).scanCards).toEqual([]);
  });

  it("reads a cached body that predates the rarity and domain fields", () => {
    const stale = summary(3);
    const thumbnails = stale.thumbnails.map(
      ({ imageId, name, shortCode, variantLabel, priceCents }) => ({
        imageId,
        name,
        shortCode,
        variantLabel,
        priceCents,
      }),
    );
    const samples = featuresSamples({ ...stale, thumbnails } as unknown as LandingSummaryResponse, {
      scanner: true,
    });
    expect(samples.catalogCards.map((card) => card.domains)).toEqual([[], [], []]);
    expect(samples.catalogCards.map((card) => card.rarity)).toEqual(["", "", ""]);
  });

  it("returns empty slices before the summary loads", () => {
    const samples = featuresSamples(undefined, { scanner: true });
    expect(samples.heroUrls).toEqual([]);
    expect(samples.discordCard).toBeUndefined();
  });
});

describe("landingSamples", () => {
  it("gives the fan, the scanner and the groups different cards", () => {
    const urls = allUrls({ ...landingSamples(summary(36)) });
    expect(urls).toHaveLength(17);
    expect(new Set(urls).size).toBe(17);
  });
});
