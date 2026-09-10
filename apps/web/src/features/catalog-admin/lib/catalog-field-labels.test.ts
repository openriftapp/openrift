import { describe, expect, it } from "vitest";

import {
  CARD_FIELD_LABELS,
  COMPARABLE_CARD_FIELDS,
  COMPARABLE_PRINTING_FIELDS,
  formatFieldValue,
  hasFieldValue,
  PRINTING_FIELD_LABELS,
  sameFieldValue,
} from "./catalog-field-labels";

describe("labels", () => {
  it("labels every comparable field", () => {
    for (const field of COMPARABLE_CARD_FIELDS) {
      expect(CARD_FIELD_LABELS[field]).toBeTruthy();
    }
    for (const field of COMPARABLE_PRINTING_FIELDS) {
      expect(PRINTING_FIELD_LABELS[field]).toBeTruthy();
    }
  });
});

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

describe("formatFieldValue", () => {
  it("renders a dash for a missing value", () => {
    expect(formatFieldValue(null)).toBe("—");
  });

  it("joins arrays and words booleans", () => {
    expect(formatFieldValue(["calm", "fury"])).toBe("calm, fury");
    expect(formatFieldValue(true)).toBe("Yes");
    expect(formatFieldValue(false)).toBe("No");
  });
});
