import { describe, expect, it, vi } from "vitest";

import { normalizeCardFieldValue, normalizeCardName, writeCardField } from "./card-field-writes.js";

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

describe("writeCardField unknown slugs", () => {
  const fk = () => Object.assign(new Error("fk"), { code: "23503" });

  it("answers an unknown domain with a 400 naming the field", async () => {
    const mut = { replaceCardDomainsById: vi.fn().mockRejectedValue(fk()) };
    await expect(
      writeCardField(mut as never, { cardId: "card-1", field: "domains", value: ["Fury"] }),
    ).rejects.toMatchObject({ status: 400, message: "Invalid value for domains: Fury" });
  });

  it("answers an unknown supertype with a 400 naming the field", async () => {
    const mut = { replaceCardSuperTypesById: vi.fn().mockRejectedValue(fk()) };
    await expect(
      writeCardField(mut as never, { cardId: "card-1", field: "superTypes", value: ["Hero"] }),
    ).rejects.toMatchObject({ status: 400, message: "Invalid value for superTypes: Hero" });
  });
});
