import { describe, expect, it } from "vitest";

import type { EmbedBank } from "./embed";
import {
  DEFAULT_SESSION_OPTIONS,
  centeredGuideQuad,
  gatesForBank,
  gatesForEmbedDim,
} from "./session-options";
import { CARD_ASPECT } from "./types";

function bankOf(dim: number, count: number): EmbedBank {
  return {
    keys: Array.from({ length: count }, (_, index) => `key-${index}`),
    vectors: new Float32Array(dim * count),
  };
}

describe("gatesForBank", () => {
  it("reads the encoder off the bank's embedding dimension", () => {
    expect(gatesForBank(bankOf(256, 8)).topK).toBe(2);
    expect(gatesForBank(bankOf(512, 8)).topK).toBe(DEFAULT_SESSION_OPTIONS.topK);
  });

  it("falls back to the clip-calibrated gates for an empty bank", () => {
    expect(gatesForBank(bankOf(256, 0))).toEqual(gatesForEmbedDim(0));
  });
});

describe("gatesForEmbedDim", () => {
  it("returns the custom-encoder calibration for 256-dimensional banks", () => {
    const gates = gatesForEmbedDim(256);
    expect(gates.confidentDistance).toBe(0.35);
    expect(gates.rotationFallbackDistance).toBe(0.42);
    expect(gates.slowRotationFallbackDistance).toBeLessThan(0.457);
    expect(gates.topK).toBe(2);
  });

  it("returns the MobileCLIP clip calibration for every other dimension", () => {
    for (const dim of [512, 0, 384]) {
      const gates = gatesForEmbedDim(dim);
      expect(gates.confidentDistance).toBe(DEFAULT_SESSION_OPTIONS.confidentDistance);
      expect(gates.rotationFallbackDistance).toBe(DEFAULT_SESSION_OPTIONS.rotationFallbackDistance);
      expect(gates.slowRotationFallbackDistance).toBe(0.45);
      expect(gates.topK).toBe(DEFAULT_SESSION_OPTIONS.topK);
    }
  });
});

describe("centeredGuideQuad", () => {
  it("centers a card-proportioned rect at 0.7 of the frame height", () => {
    const [topLeft, topRight, bottomRight] = centeredGuideQuad(1000, 800);
    const height = bottomRight.y - topRight.y;
    const width = topRight.x - topLeft.x;
    expect(height).toBeCloseTo(560);
    expect(width / height).toBeCloseTo(CARD_ASPECT);
    expect(topLeft.x).toBeCloseTo(1000 - topRight.x);
    expect(topLeft.y).toBeCloseTo(800 - bottomRight.y);
  });

  it("falls back to 0.9 of the width on a narrow portrait frame", () => {
    const [topLeft, topRight, bottomRight] = centeredGuideQuad(464, 848);
    const width = topRight.x - topLeft.x;
    expect(width).toBeCloseTo(0.9 * 464);
    expect(bottomRight.y - topRight.y).toBeCloseTo(width / CARD_ASPECT);
  });

  it("returns its corners clockwise from the top left", () => {
    const quad = centeredGuideQuad(1000, 800);
    expect(quad[0].x).toBeLessThan(quad[1].x);
    expect(quad[1].y).toBeLessThan(quad[2].y);
    expect(quad[3].x).toBeLessThan(quad[2].x);
    expect(quad[0].y).toBeLessThan(quad[3].y);
  });
});
