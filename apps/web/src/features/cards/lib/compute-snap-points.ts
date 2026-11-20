import { clamp } from "@openrift/shared/math";
import type { Virtualizer } from "@tanstack/react-virtual";

import { IS_COARSE_POINTER } from "@/lib/pointer";

import type { SnapPoint, VRow } from "./card-grid-types";

const INDICATOR_PAD = 4;

interface ComputeSnapPointsParams {
  virtualRows: VRow[];
  rowStarts: number[];
  virtualizer: Virtualizer<Window, Element>;
  scrollMargin: number;
  multipleGroups: boolean;
  indicatorH: number;
  stickyOffset: number;
}

export function computeSnapPoints({
  virtualRows,
  rowStarts,
  virtualizer,
  scrollMargin,
  multipleGroups,
  indicatorH,
  stickyOffset,
}: ComputeSnapPointsParams): SnapPoint[] {
  if (!multipleGroups) {
    return [];
  }
  const viewportH = globalThis.innerHeight;
  const totalSize = virtualizer.getTotalSize();
  const contentStart = scrollMargin - stickyOffset;
  const contentEnd = scrollMargin + totalSize - viewportH;
  const contentRange = contentEnd - contentStart;
  if (contentRange <= 0) {
    return [];
  }
  const halfH = indicatorH / 2;
  const trackTop = stickyOffset + halfH + INDICATOR_PAD;
  const trackBottom = viewportH - halfH - INDICATOR_PAD;

  const measuredStarts = new Map(
    virtualizer.getVirtualItems().map((item) => [item.index, item.start - scrollMargin]),
  );

  const points: SnapPoint[] = [];

  for (const [i, row] of virtualRows.entries()) {
    if (row.kind !== "header") {
      continue;
    }
    const rowStart = measuredStarts.get(i) ?? rowStarts[i];
    if (rowStart === undefined) {
      continue;
    }
    const headerScrollY = rowStart + scrollMargin - stickyOffset;
    const contentPct = clamp((headerScrollY - contentStart) / contentRange, 0, 1);
    const screenY = Math.round(trackTop + contentPct * (trackBottom - trackTop));
    let firstCardId = "";
    for (const next of virtualRows.slice(i + 1)) {
      if (next.kind === "header") {
        break;
      }
      const first = next.items[0];
      if (first) {
        firstCardId = first.printing.shortCode;
        break;
      }
    }
    points.push({
      rowIndex: i,
      group: row.group,
      screenY,
      cardCount: row.cardCount,
      firstCardId,
    });
  }

  const gap =
    points.length > 1
      ? Math.min(IS_COARSE_POINTER ? 32 : 26, (trackBottom - trackTop) / (points.length - 1))
      : 0;
  let previousY: number | undefined;
  for (const point of points) {
    if (previousY !== undefined && point.screenY - previousY < gap) {
      point.screenY = previousY + gap;
    }
    previousY = point.screenY;
  }
  let nextY: number | undefined;
  for (const point of points.toReversed()) {
    const limit = nextY === undefined ? trackBottom : nextY - gap;
    point.screenY = Math.round(Math.min(point.screenY, limit));
    nextY = point.screenY;
  }

  return points;
}
