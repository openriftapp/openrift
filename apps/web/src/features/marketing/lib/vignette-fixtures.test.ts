import { enumLabel } from "@openrift/shared/enum-label";
import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";
import { describe, expect, it } from "vitest";

import { parseImportData } from "@/features/collections/lib/import-parsers";

import {
  FIXTURE_CARDS,
  FIXTURE_LABELS,
  FIXTURE_PRICES,
  IMPORT_SAMPLE_LINES,
  IMPORT_SAMPLE_MATCHES,
  fixtureVariantLabel,
} from "./vignette-fixtures";

describe("vignette fixtures", () => {
  it("prices the sample card on every marketplace the product lists", () => {
    expect(Object.keys(FIXTURE_PRICES).toSorted()).toEqual([...ALL_MARKETPLACES].toSorted());
  });

  it("names the main zone the way the admin labels do", () => {
    expect(enumLabel(FIXTURE_LABELS.zones, "main")).toBe("Main");
  });

  it("words variants like the product's variant label", () => {
    expect(fixtureVariantLabel(FIXTURE_CARDS.hiddenBlade)).toBe("Standard");
    expect(fixtureVariantLabel(FIXTURE_CARDS.draven)).toBe("Alt Art · Foil");
  });
});

describe("import sample", () => {
  it("is accepted by the real importer and matches the rows the vignette shows", () => {
    const result = parseImportData(IMPORT_SAMPLE_LINES.join("\n"));

    expect(result.errors).toEqual([]);
    expect(
      result.entries.map((entry) => ({
        quantity: entry.quantity,
        code: entry.sourceCode,
        finish: entry.finish,
        artVariant: entry.artVariant,
      })),
    ).toEqual(
      IMPORT_SAMPLE_MATCHES.map((match) => ({
        quantity: match.quantity,
        code: match.card.shortCode,
        finish: match.card.finish,
        artVariant: match.card.artVariant,
      })),
    );
  });
});
