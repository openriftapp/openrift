import type { Virtualizer } from "@tanstack/react-virtual";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { VRow } from "./card-grid-types";
import { computeSnapPoints } from "./compute-snap-points";

const VIEWPORT_H = 800;
const STICKY_OFFSET = 100;
const INDICATOR_H = 32;
const TRACK_TOP = STICKY_OFFSET + INDICATOR_H / 2 + 4;
const TRACK_BOTTOM = VIEWPORT_H - INDICATOR_H / 2 - 4;

const virtualizer = {
  getTotalSize: () => 10_000,
  getVirtualItems: () => [],
} as unknown as Virtualizer<Window, Element>;

function headersAt(starts: number[]) {
  const virtualRows: VRow[] = starts.map((_, i) => ({
    kind: "header",
    group: { id: `g${i}`, slug: `G${i}`, name: `Group ${i}` },
    cardCount: 1,
  }));
  return computeSnapPoints({
    virtualRows,
    rowStarts: starts,
    virtualizer,
    scrollMargin: 0,
    multipleGroups: true,
    indicatorH: INDICATOR_H,
    stickyOffset: STICKY_OFFSET,
  });
}

describe("computeSnapPoints", () => {
  let originalInnerHeight: number;
  beforeEach(() => {
    originalInnerHeight = globalThis.innerHeight;
    globalThis.innerHeight = VIEWPORT_H;
  });
  afterEach(() => {
    globalThis.innerHeight = originalInnerHeight;
  });

  it("places spread-out groups proportionally along the track", () => {
    const points = headersAt([0, 4650, 9300]);
    expect(points.map((p) => p.screenY)).toEqual([TRACK_TOP, 450, TRACK_BOTTOM]);
  });

  it("keeps crowded groups at the end of the page inside the track", () => {
    const points = headersAt([0, 9150, 9160, 9170, 9180, 9190]);
    const ys = points.map((p) => p.screenY);
    expect(ys.at(-1)).toBeLessThanOrEqual(TRACK_BOTTOM);
    for (const [i, y] of ys.slice(1).entries()) {
      expect(y - (ys[i] ?? 0)).toBeGreaterThanOrEqual(26);
    }
  });

  it("squeezes the gap when the groups do not fit the track", () => {
    const points = headersAt(Array.from({ length: 60 }, (_, i) => 9000 + i));
    const ys = points.map((p) => p.screenY);
    expect(ys[0]).toBeGreaterThanOrEqual(TRACK_TOP);
    expect(ys.at(-1)).toBeLessThanOrEqual(TRACK_BOTTOM);
    expect(ys).toEqual(ys.toSorted((a, b) => a - b));
  });
});
