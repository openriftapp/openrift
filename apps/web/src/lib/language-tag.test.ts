import { describe, expect, it } from "vitest";

import { htmlLangTag } from "./language-tag";

describe("htmlLangTag", () => {
  it("maps catalogue codes to BCP 47 tags", () => {
    expect(htmlLangTag("EN")).toBe("en");
    expect(htmlLangTag("FR")).toBe("fr");
  });

  it("maps codes that are not their own language subtag", () => {
    expect(htmlLangTag("KR")).toBe("ko");
    expect(htmlLangTag("SC")).toBe("zh-Hans");
  });

  it("accepts lowercase input", () => {
    expect(htmlLangTag("en")).toBe("en");
  });

  it("returns undefined rather than guessing at an unmapped code", () => {
    expect(htmlLangTag("JP")).toBeUndefined();
    expect(htmlLangTag("")).toBeUndefined();
    expect(htmlLangTag(null)).toBeUndefined();
    expect(htmlLangTag(undefined)).toBeUndefined();
  });
});
