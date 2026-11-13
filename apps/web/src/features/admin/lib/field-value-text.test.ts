import { labelMap } from "@openrift/shared/enum-label";
import { describe, expect, it } from "vitest";

import { formatCatalogFieldValue, formatFieldValue, formatRawValue } from "./field-value-text";

describe("formatFieldValue", () => {
  it("renders a dash for every empty shape", () => {
    expect(formatFieldValue(null)).toBe("—");
    expect(formatFieldValue(undefined)).toBe("—");
    expect(formatFieldValue("")).toBe("—");
    expect(formatFieldValue([])).toBe("—");
  });

  it("keeps zero and false as values", () => {
    expect(formatFieldValue(0)).toBe("0");
    expect(formatFieldValue(false)).toBe("No");
    expect(formatFieldValue(true)).toBe("Yes");
  });

  it("joins arrays with a comma", () => {
    expect(formatFieldValue(["calm", "fury"])).toBe("calm, fury");
  });

  it("labels scalars and every array entry", () => {
    const label = (entry: string) => entry.toUpperCase();
    expect(formatFieldValue("calm", label)).toBe("CALM");
    expect(formatFieldValue(["calm", "fury"], label)).toBe("CALM, FURY");
  });

  it("prints objects as JSON", () => {
    expect(formatFieldValue({ a: 1 })).toBe('{"a":1}');
  });
});

describe("formatCatalogFieldValue", () => {
  const labels = {
    domains: labelMap([{ slug: "fury", label: "Fury" }]),
    rarities: labelMap([{ slug: "epic", label: "Epic" }]),
  };

  it("labels enum fields and falls back to the slug", () => {
    expect(formatCatalogFieldValue("domains", ["fury", "order"], labels)).toBe("Fury, order");
    expect(formatCatalogFieldValue("rarity", "epic", labels)).toBe("Epic");
  });

  it("labels printing list fields and formats public codes", () => {
    const printing = {
      markers: labelMap([{ slug: "promo", label: "Promo" }]),
      channels: labelMap([{ slug: "skirmish", label: "Organized play › Summoner Skirmish" }]),
    };
    expect(formatCatalogFieldValue("markerSlugs", ["promo", "signed"], printing)).toBe(
      "Promo, signed",
    );
    expect(formatCatalogFieldValue("distributionChannelSlugs", ["skirmish"], printing)).toBe(
      "Organized play › Summoner Skirmish",
    );
    expect(formatCatalogFieldValue("artist", "", printing)).toBe("—");
    expect(formatCatalogFieldValue("isSigned", true, printing)).toBe("Yes");
  });

  it("leaves unlabelled fields as written", () => {
    expect(formatCatalogFieldValue("tags", ["Jinx", "Zaun"], labels)).toBe("Jinx, Zaun");
    expect(formatCatalogFieldValue("might", 0)).toBe("0");
  });

  it("shows date fields as a UTC day", () => {
    expect(formatCatalogFieldValue("announcedAt", "2026-08-15T23:59:00.000Z")).toBe("2026-08-15");
    expect(formatCatalogFieldValue("releasedAt", "2026-08-15")).toBe("2026-08-15");
    expect(formatCatalogFieldValue("releasedAt", null)).toBe("—");
  });
});

describe("formatRawValue", () => {
  it("tells empty string, null and absent apart", () => {
    expect(formatRawValue("")).toBe('""');
    expect(formatRawValue(null)).toBe("null");
    expect(formatRawValue(undefined)).toBe("undefined");
    expect(formatRawValue("abc")).toBe('"abc"');
    expect(formatRawValue(["a"])).toBe('["a"]');
  });
});
