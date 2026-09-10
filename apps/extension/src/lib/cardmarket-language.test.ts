import { describe, expect, it } from "vitest";

import { cardmarketLanguageId } from "./cardmarket-language";

describe("cardmarketLanguageId", () => {
  it("reads the four Riftbound languages in every interface language", () => {
    for (const label of ["English", "Englisch", "Anglais", "Inglés", "Inglese"]) {
      expect(cardmarketLanguageId(label)).toBe(1);
    }
    for (const label of ["French", "Französisch", "Français", "Francés", "Francese"]) {
      expect(cardmarketLanguageId(label)).toBe(2);
    }
    for (const label of ["Korean", "Koreanisch", "Coréen", "Coreano"]) {
      expect(cardmarketLanguageId(label)).toBe(10);
    }
    for (const label of ["S-Chinese", "S-Chinesisch", "Chinois simplifié", "Chino simplificado"]) {
      expect(cardmarketLanguageId(label)).toBe(6);
    }
  });

  it("tells traditional Chinese apart from simplified", () => {
    expect(cardmarketLanguageId("T-Chinese")).toBe(11);
    expect(cardmarketLanguageId("Chinois traditionnel")).toBe(11);
  });

  it("places the other Cardmarket languages", () => {
    expect(cardmarketLanguageId("German")).toBe(3);
    expect(cardmarketLanguageId("Deutsch")).toBe(3);
    expect(cardmarketLanguageId("Spanish")).toBe(4);
    expect(cardmarketLanguageId("Italienisch")).toBe(5);
    expect(cardmarketLanguageId("Japanese")).toBe(7);
    expect(cardmarketLanguageId("Portugiesisch")).toBe(8);
    expect(cardmarketLanguageId("Russian")).toBe(9);
  });

  it("gives up on labels that are not a language", () => {
    expect(cardmarketLanguageId("Foil")).toBeUndefined();
    expect(cardmarketLanguageId("Near Mint")).toBeUndefined();
    expect(cardmarketLanguageId("")).toBeUndefined();
  });
});
