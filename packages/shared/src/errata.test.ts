import { describe, expect, it } from "vitest";

import { errataForLanguage } from "./errata.js";
import type { CardErrata } from "./types/catalog.js";

function errata(language: string, correctedRulesText: string): CardErrata {
  return {
    language,
    correctedRulesText,
    correctedEffectText: null,
    source: "Errata",
    sourceUrl: null,
    effectiveDate: null,
  };
}

describe("errataForLanguage", () => {
  const en = errata("EN", "Deal 3 to a unit.");
  const fr = errata("FR", "Infligez 3 dégâts à une unité.");

  it("returns the errata in the printing's language", () => {
    expect(errataForLanguage([en, fr], "FR")).toBe(fr);
    expect(errataForLanguage([en, fr], "EN")).toBe(en);
  });

  it("does not fall back to the English errata for another language", () => {
    expect(errataForLanguage([en], "FR")).toBeNull();
    expect(errataForLanguage([en], "SC")).toBeNull();
  });

  it("returns null for a card without errata", () => {
    expect(errataForLanguage([], "EN")).toBeNull();
  });
});
