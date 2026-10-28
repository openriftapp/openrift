import { describe, expect, it } from "vitest";

import { applySuggestion, searchSuggestions } from "./search-suggestions";

const vocabulary = {
  domain: ["fury", "calm", "chaos"],
  set: ["OGN", "SFD"],
  format: ["standard", "freeform"],
  marker: ["prerelease promo"],
};

function labels(query: string, caret = query.length) {
  return searchSuggestions(query, caret, vocabulary)?.suggestions.map((entry) => entry.label);
}

describe("searchSuggestions", () => {
  it("returns nothing for an empty token", () => {
    expect(searchSuggestions("", 0, vocabulary)).toBeNull();
    expect(searchSuggestions("garen ", 6, vocabulary)).toBeNull();
  });

  it("suggests keys whose alias starts with the typed letters", () => {
    expect(labels("dom")).toEqual(["domain:"]);
    expect(labels("ft")).toEqual(["ft:"]);
  });

  it("inserts number keys without an operator", () => {
    expect(labels("ener")).toEqual(["energy"]);
  });

  it("suggests no keys for a word no alias starts with", () => {
    expect(labels("garen")).toBeUndefined();
  });

  it("suggests values from the vocabulary after a key", () => {
    expect(labels("d:c")).toEqual(["calm", "chaos"]);
    expect(labels("s:")).toEqual(["OGN", "SFD"]);
  });

  it("continues a domain list after its last comma", () => {
    const result = searchSuggestions("d<=fury,c", 9, vocabulary);
    expect(result?.suggestions.map((entry) => entry.insert)).toEqual([
      "d<=fury,calm",
      "d<=fury,chaos",
    ]);
  });

  it("suggests fixed values for is:, has: and directives", () => {
    expect(labels("is:fo")).toEqual(["foil"]);
    expect(labels("order:e")).toEqual(["energy"]);
  });

  it("drops the value already typed in full", () => {
    expect(labels("d:fury")).toBeUndefined();
  });

  it("looks past a negation and an opening paren", () => {
    expect(labels("-d:f")).toEqual(["fury"]);
    expect(searchSuggestions("(d:f", 4, vocabulary)?.start).toBe(1);
    expect(searchSuggestions("-d:f", 4, vocabulary)?.start).toBe(1);
  });

  it("reads only the token under the caret", () => {
    const result = searchSuggestions("t:unit d:c t:spell", 10, vocabulary);
    expect(result).toMatchObject({ start: 7, end: 10 });
  });
});

describe("applySuggestion", () => {
  it("replaces the token and adds a space after a value", () => {
    const result = searchSuggestions("t:unit d:c", 10, vocabulary);
    const applied = applySuggestion("t:unit d:c", result!, result!.suggestions[0]!);
    expect(applied).toEqual({ query: "t:unit d:calm ", caret: 14 });
  });

  it("leaves no space after a key so the value follows", () => {
    const result = searchSuggestions("dom", 3, vocabulary);
    expect(applySuggestion("dom", result!, result!.suggestions[0]!)).toEqual({
      query: "domain:",
      caret: 7,
    });
  });

  it("quotes a value with spaces", () => {
    const result = searchSuggestions("marker:pre", 10, vocabulary);
    expect(applySuggestion("marker:pre", result!, result!.suggestions[0]!).query).toBe(
      'marker:"prerelease promo" ',
    );
  });
});
