import {
  COMPARABLE_CARD_FIELDS,
  COMPARABLE_PRINTING_FIELDS,
} from "@openrift/shared/catalog-field-compare";
import { describe, expect, it } from "vitest";

import { CARD_FIELD_LABELS, formatFieldValue, PRINTING_FIELD_LABELS } from "./catalog-field-labels";

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
