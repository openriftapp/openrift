import type { Printing, PrintingOtherSide } from "@openrift/shared/types/catalog";
import { beforeEach, describe, expect, it } from "vitest";

import { resetIdCounter, stubPrinting } from "@/test/factories";

import { lightboxPrintingsInLanguage, withCatalogPrintings } from "./lightbox-printings";

beforeEach(() => {
  resetIdCounter();
});

function printing(shortCode: string, imageId: string | null, overrides: Partial<Printing> = {}) {
  return stubPrinting({
    setId: "ogn",
    shortCode,
    language: "EN",
    images: imageId === null ? [] : [{ imageId }],
    ...overrides,
  });
}

function back(cardId: string, cardName: string, imageId?: string): PrintingOtherSide {
  return {
    faceId: `face-${cardId}-${imageId ?? "none"}`,
    cardId,
    cardName,
    cardSlug: cardName.toLowerCase(),
    shortCode: `${cardName}-T`,
    imageId,
  };
}

describe("withCatalogPrintings", () => {
  it("adds the catalog's printings the given list lacks, after it", () => {
    const en = printing("OGN-119", "img-en", { language: "EN" });
    const kr = printing("OGN-119", "img-kr", { language: "KR" });

    expect(withCatalogPrintings([en], [kr, en])).toEqual([en, kr]);
  });

  it("keeps the given list when the catalog has nothing for the card", () => {
    const en = printing("OGN-119", "img-en", { language: "EN" });

    expect(withCatalogPrintings([en], [])).toEqual([en]);
  });
});

describe("lightboxPrintingsInLanguage", () => {
  it("shows each design's member in the chosen language", () => {
    const en = printing("OGN-119", "img-en", { language: "EN" });
    const kr = printing("OGN-119", "img-kr", { language: "KR" });
    const enAlt = printing("OGN-119a", "img-en-alt", { language: "EN", artVariant: "altart" });
    const krAlt = printing("OGN-119a", "img-kr-alt", { language: "KR", artVariant: "altart" });

    expect(lightboxPrintingsInLanguage([en, kr, enAlt, krAlt], "KR")).toEqual([kr, krAlt]);
  });

  it("leaves out designs without a printing in the chosen language", () => {
    const en = printing("OGN-119", "img-en", { language: "EN" });
    const enPromo = printing("OGN-119", "img-promo", {
      language: "EN",
      markers: [{ id: "m-1", slug: "promo", label: "Promo", description: null }],
    });
    const kr = printing("OGN-119", "img-kr", { language: "KR" });

    expect(lightboxPrintingsInLanguage([en, enPromo, kr], "KR")).toEqual([kr]);
  });

  it("shows every printing, also those that share an image", () => {
    const normal = printing("OGN-001", "img-a", { finish: "normal" });
    const foil = printing("OGN-001", "img-a", { finish: "foil" });

    expect(lightboxPrintingsInLanguage([normal, foil], "EN")).toEqual([normal, foil]);
  });

  it("keeps double-sided printings with different backs apart", () => {
    const withGold = printing("UNL-T02", "img-bird", { otherSide: back("gold", "Gold", "img-g") });
    const withBuff = printing("UNL-T02", "img-bird", { otherSide: back("buff", "Buff", "img-b") });

    expect(lightboxPrintingsInLanguage([withGold, withBuff])).toHaveLength(2);
  });

  it("shows every language's printing of each design without a language", () => {
    const en = printing("OGN-119", "img-en", { language: "EN" });
    const kr = printing("OGN-119", "img-kr", { language: "KR" });
    const enAlt = printing("OGN-119a", "img-en-alt", { language: "EN", artVariant: "altart" });

    expect(lightboxPrintingsInLanguage([en, kr, enAlt])).toEqual([en, kr, enAlt]);
  });
});
