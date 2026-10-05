import { describe, expect, it } from "vitest";

import { enumLabel, enumLabelsFromInit } from "./enum-label.js";

describe("enumLabel", () => {
  it("returns the mapped label for a known slug", () => {
    expect(enumLabel({ epic: "Epic" }, "epic")).toBe("Epic");
  });

  it("falls back to the slug itself when the map has no entry", () => {
    expect(enumLabel({ epic: "Epic" }, "mythic")).toBe("mythic");
  });

  it("keeps a deliberately empty label instead of falling back", () => {
    expect(enumLabel({ colorless: "" }, "colorless")).toBe("");
  });

  it("falls back on an empty map", () => {
    expect(enumLabel({}, "fury")).toBe("fury");
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
    });
    expect(labels.deckZones).toEqual({ main: "Main Deck" });
    expect(labels.cardSizes.standard).toBe("Standard");
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
    });
    expect(labels.domains).toEqual({});
  });
});
