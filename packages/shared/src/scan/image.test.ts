import { describe, expect, it } from "vitest";

import { downscaleGray, focusScore, luma, rotateRgbaCw, toCanonicalFrame, toGray } from "./image";
import type { GrayImage, RgbaImage } from "./types";

function gray(width: number, height: number, values: number[]): GrayImage {
  return { data: Uint8Array.from(values), width, height };
}

describe("toGray", () => {
  it("weights channels by BT.601 luma", () => {
    const image: RgbaImage = {
      width: 3,
      height: 1,
      data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]),
    };
    expect([...toGray(image).data]).toEqual([76, 149, 28]);
  });

  it("maps white to full luma", () => {
    const image: RgbaImage = {
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([255, 255, 255, 255]),
    };
    expect([...toGray(image).data]).toEqual([255]);
  });
});

describe("downscaleGray", () => {
  it("averages each source block into its destination bin", () => {
    const src = gray(4, 4, [0, 0, 100, 100, 0, 0, 100, 100, 200, 200, 50, 50, 200, 200, 50, 50]);
    expect([...downscaleGray(src, 2, 2).data]).toEqual([0, 100, 200, 50]);
  });

  it("copies when the size is unchanged", () => {
    const src = gray(2, 2, [1, 2, 3, 4]);
    const out = downscaleGray(src, 2, 2);
    expect([...out.data]).toEqual([1, 2, 3, 4]);
    expect(out.data).not.toBe(src.data);
  });
});

describe("luma", () => {
  it("keeps a neutral grey at its level", () => {
    expect(luma(128, 128, 128)).toBe(128);
  });

  it("weights green most and blue least", () => {
    expect(luma(0, 255, 0)).toBeGreaterThan(luma(255, 0, 0));
    expect(luma(255, 0, 0)).toBeGreaterThan(luma(0, 0, 255));
  });
});

describe("focusScore", () => {
  it("is zero for images too small to measure", () => {
    expect(focusScore(gray(2, 2, [0, 255, 255, 0]))).toBe(0);
  });

  it("is zero for a linear ramp and high for a checkerboard", () => {
    const ramp = gray(
      5,
      5,
      Array.from({ length: 25 }, (_, i) => (i % 5) * 50),
    );
    const checker = gray(
      5,
      5,
      Array.from({ length: 25 }, (_, i) => ((i + Math.floor(i / 5)) % 2) * 255),
    );
    expect(focusScore(ramp)).toBe(0);
    expect(focusScore(checker)).toBeGreaterThan(1000);
  });
});

describe("toCanonicalFrame", () => {
  const image = (width: number, height: number): RgbaImage => ({
    data: Uint8ClampedArray.from({ length: width * height * 4 }, (_value, index) => index % 251),
    width,
    height,
  });

  it("turns a landscape image 90 degrees left", () => {
    const landscape = image(3, 2);
    expect(toCanonicalFrame(landscape)).toEqual(
      rotateRgbaCw(rotateRgbaCw(rotateRgbaCw(landscape))),
    );
  });

  it("keeps a portrait image as it is", () => {
    const portrait = image(2, 3);
    expect(toCanonicalFrame(portrait)).toBe(portrait);
  });
});
