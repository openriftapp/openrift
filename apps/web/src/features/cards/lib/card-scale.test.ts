import { CARD_SCALE } from "@openrift/shared/overlay-scale";
import { describe, expect, it } from "vitest";

import { clampCardScale } from "./card-scale";

describe("clampCardScale", () => {
  it("passes a scale already in range through untouched", () => {
    expect(clampCardScale(0.75)).toBe(0.75);
  });

  it("clamps at both ends", () => {
    expect(clampCardScale(-1)).toBe(CARD_SCALE.min);
    expect(clampCardScale(2)).toBe(CARD_SCALE.max);
  });

  it("falls back to full size for a value that isn't a number", () => {
    expect(clampCardScale(Number.NaN)).toBe(CARD_SCALE.max);
    expect(clampCardScale(Number.POSITIVE_INFINITY)).toBe(CARD_SCALE.max);
  });
});
