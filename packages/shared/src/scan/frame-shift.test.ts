import { describe, expect, it } from "vitest";

import { createShiftTracker, framePyramid, frameShift, trackShift } from "./frame-shift";
import type { RgbaImage } from "./types";

function view(left: number, top: number): RgbaImage {
  const width = 480;
  const height = 848;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = x + left;
      const sy = y + top;
      const value =
        128 + 60 * Math.sin(sx / 23) * Math.cos(sy / 31) + 40 * Math.sin((sx + sy) / 57);
      const index = (y * width + x) * 4;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  return { data, width, height };
}

describe("frameShift", () => {
  it("measures a pan to the right as the scene moving left", () => {
    const shift = frameShift(framePyramid(view(0, 0)), framePyramid(view(40, 0)));
    expect(shift?.x).toBeCloseTo(-40, -1);
    expect(Math.abs(shift?.y ?? 99)).toBeLessThanOrEqual(5);
  });

  it("measures a diagonal move", () => {
    const shift = frameShift(framePyramid(view(50, 50)), framePyramid(view(20, 80)));
    expect(shift?.x).toBeCloseTo(30, -1);
    expect(shift?.y).toBeCloseTo(-30, -1);
  });

  it("reads a still camera as no shift", () => {
    expect(frameShift(framePyramid(view(10, 10)), framePyramid(view(10, 10)))).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("reads a featureless frame as no shift", () => {
    const flat: RgbaImage = {
      data: new Uint8ClampedArray(480 * 848 * 4).fill(120),
      width: 480,
      height: 848,
    };
    expect(frameShift(framePyramid(flat), framePyramid(flat))).toEqual({ x: 0, y: 0 });
  });

  it("gives up on motion beyond its search range", () => {
    expect(frameShift(framePyramid(view(0, 0)), framePyramid(view(300, 0)))).toBeNull();
  });
});

describe("trackShift", () => {
  function sweep(step: number, frames: number): number {
    const tracker = createShiftTracker();
    let total = 0;
    for (let index = 0; index <= frames; index++) {
      total += trackShift(tracker, framePyramid(view(index * step, 0))).x;
    }
    return total;
  }

  it("adds up a slow pan that moves less than a block per frame", () => {
    expect(sweep(3, 40)).toBeCloseTo(-120, -1);
  });

  it("keeps a long pan on track across key frames", () => {
    expect(Math.abs(sweep(10, 40) + 400)).toBeLessThan(25);
  });

  it("reads a lost frame as no motion", () => {
    const tracker = createShiftTracker();
    trackShift(tracker, framePyramid(view(0, 0)));
    expect(trackShift(tracker, framePyramid(view(300, 0)))).toEqual({ x: 0, y: 0 });
    expect(tracker.lost).toBe(true);
    trackShift(tracker, framePyramid(view(302, 0)));
    expect(tracker.lost).toBe(false);
  });
});
