import { describe, expect, it } from "vitest";

import { heatmapPeaks } from "./heatmap";

describe("heatmapPeaks", () => {
  const WIDTH = 5;
  const HEIGHT = 3;
  const heat = (cells: Record<number, number>) => {
    const out = new Float32Array(WIDTH * HEIGHT);
    for (const [index, value] of Object.entries(cells)) {
      out[Number(index)] = value;
    }
    return out;
  };

  it("returns local maxima above the threshold, strongest first", () => {
    expect(heatmapPeaks(heat({ 0: 0.5, 4: 0.75, 12: 0.25 }), WIDTH, HEIGHT, 0.3)).toEqual([
      { x: 4, y: 0, value: 0.75 },
      { x: 0, y: 0, value: 0.5 },
    ]);
  });

  it("counts a plateau once, at its first cell in reading order", () => {
    expect(
      heatmapPeaks(heat({ 6: 0.75, 7: 0.75, 11: 0.75, 12: 0.75 }), WIDTH, HEIGHT, 0.3),
    ).toEqual([{ x: 1, y: 1, value: 0.75 }]);
  });
});
