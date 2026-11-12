import { labelMapOf } from "@openrift/shared/enum-label";
import { printingVariantPartsEnglish } from "@openrift/shared/printing-label";
import { describe, expect, it } from "vitest";

import type { ContributeFormPrinting } from "@/features/contribute/lib/contribute-json";
import { emptyPrinting } from "@/features/contribute/lib/contribute-json";
import {
  isBlankPrinting,
  toVariantLabelPrinting,
} from "@/features/contribute/lib/contribute-printing-labels";

const markerLabels = labelMapOf({ promo: "Promo", judge: "Judge" });

const enumLabels = {
  artVariants: labelMapOf({ normal: "Normal art", alternate: "Alt Art" }),
  finishes: labelMapOf({ normal: "Normal", foil: "Foil" }),
  cardSizes: labelMapOf({ standard: "Standard", oversized: "Oversized" }),
  languages: labelMapOf({ EN: "English" }),
};

function printing(overrides: Partial<ContributeFormPrinting> = {}): ContributeFormPrinting {
  return { ...emptyPrinting(), setId: "ogn", publicCode: "OGN-024/298", ...overrides };
}

function labelOf(target: ContributeFormPrinting, siblings: ContributeFormPrinting[]): string {
  return (
    printingVariantPartsEnglish(
      toVariantLabelPrinting(target, markerLabels),
      siblings.map((sibling) => toVariantLabelPrinting(sibling, markerLabels)),
      enumLabels,
    ).join(" · ") || "Standard"
  );
}

describe("toVariantLabelPrinting", () => {
  it("fills unanswered fields with the defaults the catalog would store", () => {
    expect(toVariantLabelPrinting(emptyPrinting(), markerLabels)).toEqual({
      language: "EN",
      artVariant: "normal",
      finish: "normal",
      size: "standard",
      isSigned: false,
      isOvernumbered: false,
      markers: [],
    });
  });

  it("resolves marker slugs to their labels", () => {
    const result = toVariantLabelPrinting(printing({ markerSlugs: ["promo"] }), markerLabels);
    expect(result.markers).toEqual([{ slug: "promo", label: "Promo" }]);
  });

  it("separates printings that differ only by marker", () => {
    const plain = printing({ language: "EN", finish: "foil" });
    const promo = printing({ language: "EN", finish: "foil", markerSlugs: ["promo"] });
    const siblings = [plain, promo];
    expect(labelOf(plain, siblings)).toBe("Standard");
    expect(labelOf(promo, siblings)).toBe("Promo");
  });

  it("drops what every sibling shares and keeps what varies", () => {
    const siblings = [
      printing({ language: "EN", finish: "normal" }),
      printing({ language: "EN", finish: "foil" }),
      printing({ language: "FR", finish: "normal" }),
    ];
    expect(siblings.map((p) => labelOf(p, siblings))).toEqual(["English", "English · Foil", "FR"]);
  });

  it("labels a lone plain printing Standard", () => {
    const only = printing();
    expect(labelOf(only, [only])).toBe("Standard");
  });
});

describe("isBlankPrinting", () => {
  it("is true for a freshly added printing", () => {
    expect(isBlankPrinting(emptyPrinting())).toBe(true);
  });

  it("is false once any identifying field is set", () => {
    expect(isBlankPrinting(printing())).toBe(false);
    expect(isBlankPrinting({ ...emptyPrinting(), markerSlugs: ["promo"] })).toBe(false);
    expect(isBlankPrinting({ ...emptyPrinting(), isSigned: true })).toBe(false);
  });
});
