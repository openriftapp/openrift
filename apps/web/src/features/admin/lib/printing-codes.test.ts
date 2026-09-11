import { describe, expect, it } from "vitest";

import { setSlugFromShortCode, shortCodeFromPublicCode } from "./printing-codes";

describe("shortCodeFromPublicCode", () => {
  it("drops the printed total", () => {
    expect(shortCodeFromPublicCode("UNL-131/219")).toBe("UNL-131");
    expect(shortCodeFromPublicCode("OGN-303a/298")).toBe("OGN-303a");
  });

  it("keeps the set and the number, whatever the public code adds after them", () => {
    expect(shortCodeFromPublicCode("UNL-T03-P")).toBe("UNL-T03");
    expect(shortCodeFromPublicCode("SGN-T01-P-SC")).toBe("SGN-T01");
    expect(shortCodeFromPublicCode("VEN-R06b-EN-P")).toBe("VEN-R06b");
  });

  it("takes a code with neither total nor suffix as it stands", () => {
    expect(shortCodeFromPublicCode("UNL-131")).toBe("UNL-131");
    expect(shortCodeFromPublicCode("PROMO")).toBe("PROMO");
  });

  it("has no code to read from a blank value", () => {
    expect(shortCodeFromPublicCode("")).toBeNull();
    expect(shortCodeFromPublicCode(null)).toBeNull();
    expect(shortCodeFromPublicCode(undefined)).toBeNull();
  });
});

describe("setSlugFromShortCode", () => {
  it("reads the set off a short code", () => {
    expect(setSlugFromShortCode("UNL-131")).toBe("UNL");
    expect(setSlugFromShortCode("OGN-303a")).toBe("OGN");
    expect(setSlugFromShortCode("VEN-R06b")).toBe("VEN");
  });

  it("has no set for a code with no prefix", () => {
    expect(setSlugFromShortCode("")).toBeNull();
    expect(setSlugFromShortCode("-131")).toBeNull();
    expect(setSlugFromShortCode(null)).toBeNull();
    expect(setSlugFromShortCode(undefined)).toBeNull();
  });

  it("takes a code with no dash as its own set", () => {
    expect(setSlugFromShortCode("PROMO")).toBe("PROMO");
  });
});
