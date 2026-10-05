import { describe, expect, it } from "vitest";

import { containsPattern, startsWithPattern } from "./like-pattern.js";

describe("containsPattern", () => {
  it("wraps a plain term in wildcards", () => {
    expect(containsPattern("Summoner Skirmish")).toBe("%Summoner Skirmish%");
  });

  it("escapes the LIKE wildcards and the escape character", () => {
    expect(containsPattern(String.raw`100%_a\b`)).toBe(String.raw`%100\%\_a\\b%`);
  });

  it("matches everything for an empty term", () => {
    expect(containsPattern("")).toBe("%%");
  });
});

describe("startsWithPattern", () => {
  it("appends one trailing wildcard", () => {
    expect(startsWithPattern("meta.")).toBe("meta.%");
  });

  it("keeps an underscore in a job kind literal", () => {
    expect(startsWithPattern("meta.uvsgames_")).toBe(String.raw`meta.uvsgames\_%`);
  });
});
