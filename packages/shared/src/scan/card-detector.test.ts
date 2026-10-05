import { describe, expect, it } from "vitest";

import {
  CARD_DETECTOR_STRIDE,
  CARD_DETECTOR_VIEW_HEIGHT,
  CARD_DETECTOR_VIEW_WIDTH,
  candidateFromCorners,
  cornersFromHeatmap,
  cardDetectorCandidates,
  detectorWindow,
  fillCardDetectorInput,
} from "./card-detector";
import { centeredGuideQuad } from "./session-options";

const W = CARD_DETECTOR_VIEW_WIDTH / CARD_DETECTOR_STRIDE;
const H = CARD_DETECTOR_VIEW_HEIGHT / CARD_DETECTOR_STRIDE;

function heatmapWith(points: { x: number; y: number; value?: number }[]): Float32Array {
  const heat = new Float32Array(W * H);
  for (const point of points) {
    heat[point.y * W + point.x] = point.value ?? 0.9;
  }
  return heat;
}

describe("detectorWindow", () => {
  it("centres a guide-shaped window a quarter taller than the guide", () => {
    const guide = centeredGuideQuad(480, 848);
    const window = detectorWindow(480, 848);
    expect(window.height).toBeCloseTo((guide[3].y - guide[0].y) * 1.25, 6);
    expect(window.width / window.height).toBeCloseTo(
      CARD_DETECTOR_VIEW_WIDTH / CARD_DETECTOR_VIEW_HEIGHT,
      6,
    );
    expect(window.y + window.height / 2).toBeCloseTo(424, 6);
  });
});

describe("cornersFromHeatmap", () => {
  it("orders four peaks top-left, top-right, bottom-right, bottom-left", () => {
    const corners = cornersFromHeatmap(
      heatmapWith([
        { x: 45, y: 70 },
        { x: 10, y: 10 },
        { x: 10, y: 70 },
        { x: 45, y: 10 },
      ]),
      W,
      H,
    );
    expect(corners).toEqual([
      { x: 10.5, y: 10.5 },
      { x: 45.5, y: 10.5 },
      { x: 45.5, y: 70.5 },
      { x: 10.5, y: 70.5 },
    ]);
  });

  it("returns null with fewer than four clear peaks", () => {
    const heat = heatmapWith([
      { x: 10, y: 10 },
      { x: 45, y: 10 },
      { x: 45, y: 70 },
      { x: 10, y: 70, value: 0.1 },
    ]);
    expect(cornersFromHeatmap(heat, W, H)).toBeNull();
  });

  it("counts neighbouring peaks as one corner, leaving too few corners", () => {
    const heat = heatmapWith([
      { x: 10, y: 10 },
      { x: 12, y: 11, value: 0.8 },
      { x: 45, y: 10 },
      { x: 45, y: 70 },
    ]);
    expect(cornersFromHeatmap(heat, W, H)).toBeNull();
  });

  it("keeps the four strongest peaks when there are more", () => {
    const corners = cornersFromHeatmap(
      heatmapWith([
        { x: 10, y: 10 },
        { x: 45, y: 10 },
        { x: 45, y: 70 },
        { x: 10, y: 70 },
        { x: 28, y: 40, value: 0.4 },
      ]),
      W,
      H,
    );
    expect(corners).toHaveLength(4);
    expect(corners).not.toContainEqual({ x: 28.5, y: 40.5 });
  });
});

describe("candidateFromCorners", () => {
  it("maps heatmap cells into frame pixels through the window", () => {
    const window = { x: 100, y: 50, width: 224, height: 320 };
    const candidate = candidateFromCorners(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 14 },
        { x: 0, y: 14 },
      ],
      window,
      480,
      848,
      0.9,
    );
    expect(candidate.quad[0]).toEqual({ x: 100, y: 50 });
    expect(candidate.quad[2]).toEqual({ x: 140, y: 106 });
    expect(candidate.quad[1]).toEqual({ x: 140, y: 50 });
    expect(candidate.score).toBe(0.9);
  });
});

describe("fillCardDetectorInput", () => {
  it("samples the window into planar RGB scaled to 0..1", () => {
    const frame = {
      data: new Uint8ClampedArray(480 * 848 * 4).fill(255),
      width: 480,
      height: 848,
    };
    const input = new Float32Array(3 * CARD_DETECTOR_VIEW_WIDTH * CARD_DETECTOR_VIEW_HEIGHT);
    const window = fillCardDetectorInput(frame, input);
    expect(window).toEqual(detectorWindow(480, 848));
    expect(input.every((value) => value === 1)).toBe(true);
  });
});

describe("cardDetectorCandidates", () => {
  const window = { x: 0, y: 0, width: 224, height: 320 };
  const frame = { width: 480, height: 848 };
  const fourPeaks = () =>
    heatmapWith([
      { x: 10, y: 10 },
      { x: 45, y: 10 },
      { x: 45, y: 70 },
      { x: 10, y: 70 },
    ]);

  it("returns one candidate when a card is present", () => {
    expect(cardDetectorCandidates(frame, window, fourPeaks(), 0.9)).toHaveLength(1);
  });

  it("returns nothing below the presence threshold", () => {
    expect(cardDetectorCandidates(frame, window, fourPeaks(), 0.2)).toEqual([]);
  });
});
