import { describe, expect, it } from "vitest";

import type { PrintingValueLabels } from "@/features/admin/lib/field-value-text";

import { variantExtras } from "./variant-facts";

const labels = {
  markers: { promo: "Promo", "top-4": "Top 4" },
  artVariants: { normal: "Normal", altart: "Alt Art" },
  cardSizes: { standard: "Standard", oversized: "Oversized" },
} as unknown as PrintingValueLabels;

describe("variantExtras", () => {
  it("is empty for a plain variant", () => {
    expect(
      variantExtras(
        {
          markerSlugs: [],
          artVariant: "normal",
          isSigned: false,
          isOvernumbered: false,
          size: "standard",
        },
        labels,
      ),
    ).toEqual([]);
  });

  it("names every deviation, markers first", () => {
    expect(
      variantExtras(
        {
          markerSlugs: ["promo", "top-4"],
          artVariant: "altart",
          isSigned: true,
          isOvernumbered: true,
          size: "oversized",
        },
        labels,
      ),
    ).toEqual(["Promo", "Top 4", "Alt Art", "Signed", "Overnumbered", "Oversized"]);
  });

  it("skips what the row does not carry", () => {
    expect(variantExtras({ markerSlugs: ["promo"] }, labels)).toEqual(["Promo"]);
  });
});
