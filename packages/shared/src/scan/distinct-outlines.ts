/** Keeps the best-scoring outline per position, dropping ones under `minScore` and ones cut by the frame edge. */
import { quadCenter, quadIou, touchesFrameEdge } from "./geometry";
import { FRAME_EDGE_MARGIN } from "./sweep";
import type { Point, Quad } from "./types";

const SAME_POSITION_IOU = 0.3;

function contains(quad: Quad, point: Point): boolean {
  let sign = 0;
  for (let index = 0; index < 4; index++) {
    const a = quad[index] as Point;
    const b = quad[(index + 1) % 4] as Point;
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (cross !== 0) {
      if (sign !== 0 && Math.sign(cross) !== sign) {
        return false;
      }
      sign = Math.sign(cross);
    }
  }
  return true;
}

export function samePosition(a: Quad, b: Quad): boolean {
  return (
    quadIou(a, b) > SAME_POSITION_IOU || contains(b, quadCenter(a)) || contains(a, quadCenter(b))
  );
}

export function distinctWholeOutlines<T extends { quad: Quad; score: number }>(
  outlines: readonly T[],
  { minScore = 0, frame }: { minScore?: number; frame?: { width: number; height: number } } = {},
): T[] {
  const kept: T[] = [];
  for (const outline of outlines.toSorted((a, b) => b.score - a.score)) {
    if (
      outline.score < minScore ||
      (frame &&
        touchesFrameEdge(outline.quad, frame.width, frame.height, frame.width * FRAME_EDGE_MARGIN))
    ) {
      continue;
    }
    if (!kept.some((other) => samePosition(outline.quad, other.quad))) {
      kept.push(outline);
    }
  }
  return kept;
}
