import { sideKey } from "@openrift/shared/printing-side";
import type { Printing, PrintingOtherSide } from "@openrift/shared/types/catalog";
import { beforeEach, describe, expect, it } from "vitest";

import { resetIdCounter, stubPrinting } from "@/test/factories";

import { lightboxPrintings, lightboxPrintingsInLanguage } from "./lightbox-printings";

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

describe("lightboxPrintings", () => {
  it("shows every printing, also those that share an image", () => {
    const normal = printing("OGN-001", "img-a", { finish: "normal" });
    const foil = printing("OGN-001", "img-a", { finish: "foil" });
    const promo = printing("OGN-001", "img-b", {
      finish: "foil",
      markers: [{ id: "m-1", slug: "promo", label: "Promo", description: null }],
    });

    expect(lightboxPrintings([normal, foil, promo])).toEqual([normal, foil, promo]);
  });

  it("shows one printing per design and prefers the first language", () => {
    const en = printing("OGN-119", "img-en", { language: "EN" });
    const kr = printing("OGN-119", "img-kr", { language: "KR" });

    expect(lightboxPrintings([en, kr])).toEqual([en]);
  });

  it("shows the selected language member of its design", () => {
    const en = printing("OGN-119", "img-en", { language: "EN" });
    const kr = printing("OGN-119", "img-kr", { language: "KR" });

    expect(lightboxPrintings([en, kr], sideKey(kr))).toEqual([kr]);
  });

  it("prefers a language member with an image over an imageless lead", () => {
    const fr = printing("OGN-119", null, { language: "FR" });
    const en = printing("OGN-119", "img-en", { language: "EN" });

    expect(lightboxPrintings([fr, en])).toEqual([en]);
  });

  it("keeps double-sided printings with different backs apart", () => {
    const withGold = printing("UNL-T02", "img-bird", { otherSide: back("gold", "Gold", "img-g") });
    const withBuff = printing("UNL-T02", "img-bird", { otherSide: back("buff", "Buff", "img-b") });

    expect(lightboxPrintings([withGold, withBuff])).toHaveLength(2);
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
});
