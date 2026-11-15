import { describe, expect, it } from "vitest";

import { normalizeCardFieldValue, normalizeCardName } from "./card-field-writes.js";

describe("normalizeCardFieldValue comment", () => {
  it("stores whitespace-only text as null", () => {
    expect(normalizeCardFieldValue("comment", "  \n\t ")).toBeNull();
    expect(normalizeCardFieldValue("comment", "")).toBeNull();
  });

  it("trims outer whitespace", () => {
    expect(normalizeCardFieldValue("comment", "  Check the errata.\n")).toBe("Check the errata.");
  });

  it("keeps null", () => {
    expect(normalizeCardFieldValue("comment", null)).toBeNull();
  });
});

describe("normalizeCardFieldValue name", () => {
  it("rejects an empty or whitespace-only name with the same error", () => {
    expect(() => normalizeCardFieldValue("name", "")).toThrow("Invalid value for name");
    expect(() => normalizeCardFieldValue("name", "  \n\t ")).toThrow("Invalid value for name");
  });

  it("trims outer whitespace", () => {
    expect(normalizeCardFieldValue("name", "  Annie, Fiery  ")).toBe("Annie, Fiery");
  });

  it("rejects a name made only of punctuation", () => {
    expect(() => normalizeCardFieldValue("name", "?!")).toThrow(
      "Invalid value for name: needs at least one letter or digit",
    );
  });
});

describe("normalizeCardName", () => {
  it("trims the name and applies the same rule as a name edit", () => {
    expect(normalizeCardName("  Annie, Fiery  ")).toBe("Annie, Fiery");
    expect(() => normalizeCardName("   ")).toThrow("Invalid value for name");
    expect(() => normalizeCardName("?!")).toThrow("Invalid value for name");
  });
});

describe("normalizeCardFieldValue other fields", () => {
  it("leaves list fields alone and maps null to an empty list", () => {
    expect(normalizeCardFieldValue("tags", null)).toEqual([]);
    expect(normalizeCardFieldValue("tags", ["a"])).toEqual(["a"]);
  });
});
