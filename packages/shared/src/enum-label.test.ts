import { describe, expect, it } from "vitest";

import {
  enumLabel,
  enumLabelsFromInit,
  labelMap,
  labelMapOf,
  mergeLabelMaps,
  slugForLabel,
} from "./enum-label.js";

describe("enumLabel", () => {
  it("returns the mapped label for a known slug", () => {
    expect(enumLabel(labelMapOf({ epic: "Epic" }), "epic")).toBe("Epic");
  });

  it("falls back to the slug itself when the map has no entry", () => {
    expect(enumLabel(labelMapOf({ epic: "Epic" }), "mythic")).toBe("mythic");
  });

  it("keeps a deliberately empty label instead of falling back", () => {
    expect(enumLabel(labelMapOf({ colorless: "" }), "colorless")).toBe("");
  });

  it("falls back on an empty map", () => {
    expect(enumLabel(labelMap([]), "fury")).toBe("fury");
  });
});

describe("labelMap", () => {
  it("keys rows by slug", () => {
    const map = labelMap([
      { slug: "foil", label: "Foil" },
      { slug: "metal-deluxe", label: "Metal Deluxe" },
    ]);
    expect(enumLabel(map, "foil")).toBe("Foil");
    expect(enumLabel(map, "metal-deluxe")).toBe("Metal Deluxe");
  });

  it("lets a later row win on a duplicate slug", () => {
    const map = labelMap([
      { slug: "foil", label: "Foil" },
      { slug: "foil", label: "Foil (new)" },
    ]);
    expect(enumLabel(map, "foil")).toBe("Foil (new)");
  });
});

describe("labelMapOf", () => {
  it("copies the record so later writes to it do not leak in", () => {
    const record: Record<string, string> = { epic: "Epic" };
    const map = labelMapOf(record);
    record.epic = "Changed";
    expect(enumLabel(map, "epic")).toBe("Epic");
  });
});

describe("mergeLabelMaps", () => {
  it("combines maps with later maps winning", () => {
    const merged = mergeLabelMaps(
      labelMapOf({ champion: "Champion", unit: "Unit" }),
      labelMapOf({ unit: "Creature" }),
    );
    expect(enumLabel(merged, "champion")).toBe("Champion");
    expect(enumLabel(merged, "unit")).toBe("Creature");
  });

  it("returns an empty map for no input", () => {
    expect(enumLabel(mergeLabelMaps(), "unit")).toBe("unit");
  });
});

describe("enumLabelsFromInit", () => {
  const rows = (slug: string, label: string) => [{ slug, label }];

  it("builds a slug to label map for each enum", () => {
    const labels = enumLabelsFromInit({
      cardTypes: rows("unit", "Unit"),
      superTypes: rows("champion", "Champion"),
      domains: rows("fury", "Fury"),
      deckZones: rows("main", "Main Deck"),
      artVariants: rows("normal", "Normal"),
      finishes: rows("foil", "Foil"),
      cardSizes: rows("standard", "Standard"),
      languages: rows("ZH", "Chinese"),
    });
    expect(enumLabel(labels.deckZones, "main")).toBe("Main Deck");
    expect(enumLabel(labels.cardSizes, "standard")).toBe("Standard");
    expect(enumLabel(labels.languages, "ZH")).toBe("Chinese");
  });

  it("returns empty maps for empty enums", () => {
    const labels = enumLabelsFromInit({
      cardTypes: [],
      superTypes: [],
      domains: [],
      deckZones: [],
      artVariants: [],
      finishes: [],
      cardSizes: [],
      languages: [],
    });
    expect(enumLabel(labels.domains, "fury")).toBe("fury");
  });
});

describe("slugForLabel", () => {
  const finishes = labelMap([
    { slug: "foil", label: "Foil" },
    { slug: "metal-deluxe", label: "Métal Deluxe" },
  ]);

  it("finds a slug by its label or by itself, folded", () => {
    expect(slugForLabel(finishes, "foil")).toBe("foil");
    expect(slugForLabel(finishes, "FOIL")).toBe("foil");
    expect(slugForLabel(finishes, "metal deluxe")).toBe("metal-deluxe");
    expect(slugForLabel(finishes, "metal-deluxe")).toBe("metal-deluxe");
  });

  it("returns undefined for text no slug reads as", () => {
    expect(slugForLabel(finishes, "Etched")).toBeUndefined();
    expect(slugForLabel(finishes, " ")).toBeUndefined();
  });
});
