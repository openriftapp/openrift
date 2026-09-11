import { describe, expect, it } from "vitest";

import { nameBeyondCardName } from "./name-suffix";

describe("nameBeyondCardName", () => {
  it("is empty when both names are the same card name", () => {
    expect(nameBeyondCardName("Abandon", "Abandon")).toBe("");
    expect(nameBeyondCardName("abandon", "Abandon")).toBe("");
    expect(nameBeyondCardName("Jayce, Brilliant Inventor", "Jayce Brilliant Inventor")).toBe("");
  });

  it("keeps what a longer name adds, without the joining punctuation", () => {
    expect(nameBeyondCardName("Abandon - Unlimited", "Abandon")).toBe("Unlimited");
    expect(nameBeyondCardName("Abandon (Foil)", "Abandon")).toBe("Foil");
    expect(nameBeyondCardName("Abandon: Alternate Art", "Abandon")).toBe("Alternate Art");
  });

  it("drops the closing bracket left behind when the card name took its opener", () => {
    expect(nameBeyondCardName("Abandon (Foil) - Unlimited", "Abandon")).toBe("Foil - Unlimited");
    expect(nameBeyondCardName("Abandon (Alternate Art)", "Abandon")).toBe("Alternate Art");
  });

  it("keeps a bracket that opens inside what the name adds", () => {
    expect(nameBeyondCardName("Abandon - Unlimited (Foil)", "Abandon")).toBe("Unlimited (Foil)");
  });

  it("keeps a name that does not start with the card's own", () => {
    expect(nameBeyondCardName("Foil Abandon", "Abandon")).toBe("Foil Abandon");
  });

  it("returns the other name when there is no card name to strip", () => {
    expect(nameBeyondCardName("Abandon", "")).toBe("Abandon");
  });
});
