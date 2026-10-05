import { describe, expect, it } from "vitest";

import { defaultRuleLanguage, querySearchSchema, rulesSearchSchema } from "./rules-search-schema";

describe("querySearchSchema", () => {
  it("keeps a query and drops everything else", () => {
    expect(querySearchSchema({ q: "might", lang: "fr" })).toEqual({ q: "might" });
  });

  it("drops an absent, blank or non-string query", () => {
    expect(querySearchSchema({})).toEqual({});
    expect(querySearchSchema({ q: "  " })).toEqual({});
    expect(querySearchSchema({ q: ["might"] })).toEqual({});
  });
});

describe("rulesSearchSchema", () => {
  it("keeps a query", () => {
    expect(rulesSearchSchema({ q: "might" })).toEqual({ q: "might" });
  });

  it("drops an absent, blank or non-string query, so the URL never carries an empty q", () => {
    expect(rulesSearchSchema({})).toEqual({});
    expect(rulesSearchSchema({ q: "" })).toEqual({});
    expect(rulesSearchSchema({ q: "   " })).toEqual({});
    expect(rulesSearchSchema({ q: 7 })).toEqual({});
  });

  it("ignores params it does not own", () => {
    expect(rulesSearchSchema({ q: "might", other: "x" })).toEqual({ q: "might" });
  });

  it("keeps a rules language", () => {
    expect(rulesSearchSchema({ lang: "fr" })).toEqual({ lang: "fr" });
    expect(rulesSearchSchema({ q: "might", lang: "zh-Hans" })).toEqual({
      q: "might",
      lang: "zh-Hans",
    });
  });

  it("drops a language that has no rules documents", () => {
    expect(rulesSearchSchema({ lang: "de" })).toEqual({});
    expect(rulesSearchSchema({ lang: "FR" })).toEqual({});
    expect(rulesSearchSchema({ lang: 1 })).toEqual({});
  });
});

describe("defaultRuleLanguage", () => {
  it("uses the UI locale when its rules exist", () => {
    expect(defaultRuleLanguage(["en", "fr", "ko"], "ko")).toBe("ko");
  });

  it("falls back to English when the UI locale has no rules", () => {
    expect(defaultRuleLanguage(["en", "fr"], "ko")).toBe("en");
    expect(defaultRuleLanguage(["en", "fr", "ko"], "de")).toBe("en");
  });
});
