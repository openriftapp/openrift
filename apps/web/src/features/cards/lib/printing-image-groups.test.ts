import { sideKey } from "@openrift/shared/printing-side";
import type { Printing, PrintingOtherSide } from "@openrift/shared/types/catalog";
import { beforeEach, describe, expect, it } from "vitest";

import { resetIdCounter, stubPrinting } from "@/test/factories";

import { groupPrintingImages } from "./printing-image-groups";

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

function summary(printings: Printing[], selected?: Printing) {
  return groupPrintingImages(printings, selected ? sideKey(selected) : undefined).groups.map(
    (group) => [group.printing.shortCode, group.printings.length, group.finishes],
  );
}

describe("groupPrintingImages", () => {
  it("merges printings that share an image and lists their finishes", () => {
    const normal = printing("OGN-119", "img-a", { finish: "normal" });
    const foil = printing("OGN-119", "img-a", { finish: "foil" });
    const alt = printing("OGN-119a", "img-b", { finish: "foil", artVariant: "altart" });

    expect(summary([normal, foil, alt])).toEqual([
      ["OGN-119", 2, ["normal", "foil"]],
      ["OGN-119a", 1, ["foil"]],
    ]);
    expect(groupPrintingImages([normal, foil, alt]).count).toBe(3);
  });

  it("keeps separate tiles for the same art printed as different images", () => {
    const overnumbered = printing("SFD-227", "img-plain", { isOvernumbered: true });
    const signed = printing("SFD-227", "img-signed", { isOvernumbered: true, isSigned: true });

    expect(summary([overnumbered, signed])).toEqual([
      ["SFD-227", 1, ["normal"]],
      ["SFD-227", 1, ["normal"]],
    ]);
  });

  it("counts one design per language group and shows the preferred language", () => {
    const en = printing("OGN-119", "img-en", { language: "EN" });
    const kr = printing("OGN-119", "img-kr", { language: "KR" });

    const { count, groups } = groupPrintingImages([en, kr]);

    expect(count).toBe(1);
    expect(groups.map((group) => group.printing)).toEqual([en]);
  });

  it("shows the selected language member in its design's tile", () => {
    const en = printing("OGN-119", "img-en", { language: "EN" });
    const kr = printing("OGN-119", "img-kr", { language: "KR" });

    expect(groupPrintingImages([en, kr], sideKey(kr)).groups.map((g) => g.printing)).toEqual([kr]);
  });

  it("prefers a language member with an image over an imageless lead", () => {
    const fr = printing("OGN-119", null, { language: "FR" });
    const en = printing("OGN-119", "img-en", { language: "EN" });

    expect(groupPrintingImages([fr, en]).groups.map((group) => group.printing)).toEqual([en]);
  });

  it("keys double-sided printings by both sides", () => {
    const withGold = printing("UNL-T02", "img-bird", { otherSide: back("gold", "Gold", "img-g") });
    const goldFoil = printing("UNL-T02", "img-bird", {
      finish: "foil",
      otherSide: back("gold", "Gold", "img-g"),
    });
    const withBuff = printing("UNL-T02", "img-bird", { otherSide: back("buff", "Buff", "img-b") });

    expect(summary([withGold, goldFoil, withBuff])).toEqual([
      ["UNL-T02", 1, ["normal"]],
      ["UNL-T02", 2, ["normal", "foil"]],
    ]);
  });

  it("keeps imageless backs of different faces on separate tiles", () => {
    const first = printing("SGN-T01", "img-bird", {
      otherSide: { ...back("brush", "Brush"), faceId: "brush-a" },
    });
    const second = printing("SGN-T01", "img-bird", {
      otherSide: { ...back("brush", "Brush"), faceId: "brush-b" },
    });

    expect(summary([first, second])).toHaveLength(2);
  });

  it("merges imageless printings of the same design across finishes", () => {
    const normal = printing("OGN-300", null, { finish: "normal" });
    const foil = printing("OGN-300", null, { finish: "foil" });
    const other = printing("OGN-301", null);

    expect(summary([normal, foil, other])).toEqual([
      ["OGN-300", 2, ["normal", "foil"]],
      ["OGN-301", 1, ["normal"]],
    ]);
  });

  it("puts the selected printing up front in a merged tile", () => {
    const normal = printing("OGN-119", "img-a", { finish: "normal" });
    const foil = printing("OGN-119", "img-a", { finish: "foil" });

    expect(groupPrintingImages([normal, foil], sideKey(foil)).groups[0]?.printing).toBe(foil);
  });
});
