import { describe, expect, it } from "vitest";

import {
  STAMP_MIN_LEAD,
  STAMP_MIN_SCORE,
  showsStamp,
  stampPair,
  stampScores,
} from "./stamp-search";
import { stampCard as card } from "./test-images";
import type { RgbaImage } from "./types";

const WIDTH = 384;
const HEIGHT = 528;

describe("stampScores", () => {
  const pair = stampPair(card({ stamp: false }), card({ stamp: true }));

  it("finds the stamp on a marked card although the outline is a few percent off", () => {
    const scores = stampScores(card({ stamp: true, shiftX: 14, shiftY: -9 }), pair);
    expect(scores.marked).toBeGreaterThanOrEqual(STAMP_MIN_SCORE);
    expect(scores.marked - scores.plain).toBeGreaterThanOrEqual(STAMP_MIN_LEAD);
    expect(showsStamp(scores)).toBe(true);
  });

  it("finds no stamp on a plain card at the same offset", () => {
    expect(showsStamp(stampScores(card({ stamp: false, shiftX: 14, shiftY: -9 }), pair))).toBe(
      false,
    );
  });

  it("finds no stamp on a featureless crop", () => {
    const blank: RgbaImage = {
      data: new Uint8ClampedArray(WIDTH * HEIGHT * 4).fill(90),
      width: WIDTH,
      height: HEIGHT,
    };
    expect(showsStamp(stampScores(blank, pair))).toBe(false);
  });

  it("reads a crop of another size at the reference geometry", () => {
    const marked = card({ stamp: true });
    const smaller: RgbaImage = {
      data: new Uint8ClampedArray((WIDTH / 2) * (HEIGHT / 2) * 4),
      width: WIDTH / 2,
      height: HEIGHT / 2,
    };
    for (let y = 0; y < smaller.height; y++) {
      for (let x = 0; x < smaller.width; x++) {
        const from = (y * 2 * WIDTH + x * 2) * 4;
        smaller.data.set(marked.data.subarray(from, from + 4), (y * smaller.width + x) * 4);
      }
    }
    expect(stampScores(smaller, pair).marked).toBeGreaterThan(
      stampScores(card({ stamp: false }), pair).marked,
    );
  });
});

describe("showsStamp", () => {
  it("needs the marked match and its lead over plain both", () => {
    expect(showsStamp({ fit: 1, marked: 0.8, plain: 0.6 })).toBe(true);
    expect(showsStamp({ fit: 1, marked: 0.65, plain: 0.2 })).toBe(false);
    expect(showsStamp({ fit: 1, marked: 0.8, plain: 0.75 })).toBe(false);
  });
});
