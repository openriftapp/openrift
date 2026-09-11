import { describe, expect, it } from "vitest";

import { differingFields, hasFieldValue, sameFieldValue } from "./catalog-field-compare.js";

describe("hasFieldValue", () => {
  it("rejects null, undefined, the empty string and the empty array", () => {
    expect(hasFieldValue(null)).toBe(false);
    expect(hasFieldValue(undefined)).toBe(false);
    expect(hasFieldValue("")).toBe(false);
    expect(hasFieldValue([])).toBe(false);
  });

  it("accepts zero and false", () => {
    expect(hasFieldValue(0)).toBe(true);
    expect(hasFieldValue(false)).toBe(true);
  });
});

describe("sameFieldValue", () => {
  it("compares arrays element-wise in order by default", () => {
    expect(sameFieldValue(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameFieldValue(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameFieldValue(["a"], ["a", "b"])).toBe(false);
  });

  it("keeps order significant for the ordered list fields", () => {
    for (const field of ["types", "superTypes", "domains", "tags"]) {
      expect(sameFieldValue(["a", "b"], ["b", "a"], field)).toBe(false);
    }
  });

  it("ignores order for marker and channel slugs", () => {
    expect(sameFieldValue(["a", "b"], ["b", "a"], "markerSlugs")).toBe(true);
    expect(sameFieldValue(["a", "b"], ["b", "a"], "distributionChannelSlugs")).toBe(true);
    expect(sameFieldValue(["a", "b"], ["a", "c"], "markerSlugs")).toBe(false);
  });

  it("treats a missing value and the empty string as the same", () => {
    expect(sameFieldValue(null, "")).toBe(true);
    expect(sameFieldValue(undefined, null)).toBe(true);
  });

  it("compares numbers against their string form", () => {
    expect(sameFieldValue(3, "3")).toBe(true);
    expect(sameFieldValue(3, 4)).toBe(false);
  });
});

describe("differingFields", () => {
  it("skips fields the proposal has no value for", () => {
    const live = { name: "Annie", might: 3, tags: ["fire"] };
    const proposed = { name: "Annie", might: null, tags: [] };
    expect(differingFields(["name", "might", "tags"], live, proposed)).toEqual([]);
  });

  it("reports fields with a value that differs", () => {
    const live = { name: "Annie", might: 3, markerSlugs: ["a", "b"] };
    const proposed = { name: "Annie", might: 4, markerSlugs: ["b", "a"] };
    expect(differingFields(["name", "might", "markerSlugs"], live, proposed)).toEqual(["might"]);
  });

  it("treats a live value the proposal lacks as no difference", () => {
    expect(differingFields(["artist"], { artist: "Someone" }, {})).toEqual([]);
  });
});
