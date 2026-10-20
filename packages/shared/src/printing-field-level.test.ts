import { describe, expect, it } from "vitest";

import { isPrintingLevelField } from "./printing-field-level";

describe("isPrintingLevelField", () => {
  it("treats physical and release fields as printing fields", () => {
    for (const field of ["size", "distributionChannelSlugs", "comment", "releasedAt"]) {
      expect(isPrintingLevelField(field)).toBe(true);
    }
  });

  it("treats printed fields as face fields", () => {
    for (const field of ["shortCode", "finish", "language", "artist", "markerSlugs", "setId"]) {
      expect(isPrintingLevelField(field)).toBe(false);
    }
  });

  it("rejects an unknown field", () => {
    expect(isPrintingLevelField("nonsense")).toBe(false);
  });
});
