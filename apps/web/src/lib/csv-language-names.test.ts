import { describe, expect, it } from "vitest";

import { languageCodeFromCsv, csvLanguageName } from "./csv-language-names";

describe("csvLanguageName", () => {
  it("writes the full name for the codes other tools spell out", () => {
    expect(csvLanguageName("EN")).toBe("English");
    expect(csvLanguageName("FR")).toBe("French");
    expect(csvLanguageName("SC")).toBe("Chinese (Simplified)");
  });

  it("writes the bare code for a language with no full name", () => {
    expect(csvLanguageName("KR")).toBe("KR");
  });
});

describe("languageCodeFromCsv", () => {
  it("reads the full names back", () => {
    expect(languageCodeFromCsv("English")).toBe("EN");
    expect(languageCodeFromCsv("french")).toBe("FR");
    expect(languageCodeFromCsv("Français")).toBe("FR");
    expect(languageCodeFromCsv("Chinese (Simplified)")).toBe("SC");
    expect(languageCodeFromCsv("Chinese")).toBe("SC");
  });

  it("reads bare catalog codes back, in any case", () => {
    expect(languageCodeFromCsv("EN")).toBe("EN");
    expect(languageCodeFromCsv("sc")).toBe("SC");
    expect(languageCodeFromCsv(" fr ")).toBe("FR");
  });

  it("remaps a code retired by a rename", () => {
    expect(languageCodeFromCsv("zh")).toBe("SC");
    expect(languageCodeFromCsv("ZH")).toBe("SC");
  });

  it("round-trips a language that has no full name", () => {
    expect(languageCodeFromCsv(csvLanguageName("KR"))).toBe("KR");
  });

  it("does not fold Traditional Chinese into Simplified", () => {
    expect(languageCodeFromCsv("Chinese (Traditional)")).toBeUndefined();
  });

  it("returns undefined for blank and non-language cells", () => {
    expect(languageCodeFromCsv(undefined)).toBeUndefined();
    expect(languageCodeFromCsv("")).toBeUndefined();
    expect(languageCodeFromCsv("   ")).toBeUndefined();
    expect(languageCodeFromCsv("SEAL")).toBeUndefined();
    expect(languageCodeFromCsv("n/a")).toBeUndefined();
  });
});
