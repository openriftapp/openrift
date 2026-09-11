import { describe, expect, it } from "vitest";

import {
  formatPrintingCode,
  isTbaCode,
  TBA_SET_SLUG,
  tbaPublicCode,
  tbaShortCode,
} from "./printing-code.js";

describe("isTbaCode", () => {
  it("matches the set-scoped placeholder and the per-card short code", () => {
    expect(isTbaCode("OGN-TBA")).toBe(true);
    expect(isTbaCode("OGN-TBA-yasuo-the-wanderer")).toBe(true);
  });

  it("matches the placeholder set's own codes", () => {
    expect(isTbaCode(tbaPublicCode(TBA_SET_SLUG))).toBe(true);
    expect(isTbaCode(tbaShortCode(TBA_SET_SLUG, "yasuo-the-wanderer"))).toBe(true);
  });

  it("rejects a real code", () => {
    expect(isTbaCode("OGN-042")).toBe(false);
    expect(isTbaCode("SFD-R01a")).toBe(false);
    expect(isTbaCode("")).toBe(false);
  });

  it("rejects a bare placeholder without a set", () => {
    expect(isTbaCode("TBA")).toBe(false);
    expect(isTbaCode("TBA-yasuo-the-wanderer")).toBe(false);
  });

  it("is case sensitive", () => {
    expect(isTbaCode("OGN-tba")).toBe(false);
    expect(isTbaCode("OGN-Tba-yasuo")).toBe(false);
  });

  it("does not match TBA outside the second segment", () => {
    expect(isTbaCode("OGN-042-TBA")).toBe(false);
  });
});

describe("tbaShortCode", () => {
  it("puts the set first and the card slug last", () => {
    expect(tbaShortCode("OGN", "yasuo-the-wanderer")).toBe("OGN-TBA-yasuo-the-wanderer");
  });

  it("doubles up for the placeholder set", () => {
    expect(tbaShortCode(TBA_SET_SLUG, "yasuo-the-wanderer")).toBe("TBA-TBA-yasuo-the-wanderer");
  });
});

describe("tbaPublicCode", () => {
  it("scopes the placeholder to the set", () => {
    expect(tbaPublicCode("OGN")).toBe("OGN-TBA");
    expect(tbaPublicCode(TBA_SET_SLUG)).toBe("TBA-TBA");
  });
});

describe("formatPrintingCode", () => {
  it("labels a placeholder code", () => {
    expect(formatPrintingCode("OGN-TBA")).toBe("Code TBA");
    expect(formatPrintingCode("OGN-TBA-yasuo-the-wanderer")).toBe("Code TBA");
  });

  it("returns a real code unchanged", () => {
    expect(formatPrintingCode("OGN-042")).toBe("OGN-042");
  });

  it("returns an empty code unchanged", () => {
    expect(formatPrintingCode("")).toBe("");
  });
});
