import { describe, expect, it } from "vitest";

import { cardsInGuide } from "./cards-in-guide";
import { SWEEP_OPTIONS } from "./sweep";
import type { CardCandidate, Quad } from "./types";

const FRAME = { width: 400, height: 600 };

function rect(left: number, top: number, width: number, height: number): Quad {
  return [
    { x: left, y: top },
    { x: left + width, y: top },
    { x: left + width, y: top + height },
    { x: left, y: top + height },
  ];
}

const GUIDE = rect(10, 10, 380, 580);

function candidate(quad: Quad, score = 0.9): CardCandidate {
  return { quad, areaFraction: 0, score };
}

describe("cardsInGuide", () => {
  it("ignores one card that fills the guide", () => {
    expect(cardsInGuide([candidate(rect(20, 20, 360, 560))], GUIDE, FRAME)).toEqual([]);
  });

  it("draws the line to an aimed card where a sweep does", () => {
    const guideArea = 380 * 580;
    const height = 540;
    const width = (guideArea * SWEEP_OPTIONS.aimedShare) / height;
    const below = rect(50, 20, width - 2, height);
    const above = rect(50, 20, width + 2, height);
    expect(cardsInGuide([candidate(below)], GUIDE, FRAME)).toEqual([below]);
    expect(cardsInGuide([candidate(above)], GUIDE, FRAME)).toEqual([]);
  });

  it("counts two whole small cards in the guide", () => {
    const left = rect(40, 200, 120, 168);
    const right = rect(240, 200, 120, 168);
    expect(cardsInGuide([candidate(left), candidate(right)], GUIDE, FRAME)).toEqual([left, right]);
  });

  it("drops a card cut off by the frame edge and collapses nested or overlapping outlines", () => {
    const whole = rect(40, 100, 120, 168);
    const kept = cardsInGuide(
      [
        candidate(rect(3, 300, 120, 168), 0.95),
        candidate(whole, 0.9),
        candidate(rect(50, 110, 120, 168), 0.8),
        candidate(rect(70, 150, 60, 84), 0.7),
      ],
      GUIDE,
      FRAME,
    );
    expect(kept).toEqual([whole]);
  });

  it("ignores a weak outline", () => {
    expect(cardsInGuide([candidate(rect(40, 200, 120, 168), 0.4)], GUIDE, FRAME)).toEqual([]);
  });
});
