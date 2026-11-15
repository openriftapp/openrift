import { clamp } from "@openrift/shared/math";

// Pixels.
export const SLOT_WIDTH = 168;
export const PHONE_SLOT_WIDTH = 132;
export const DOT_SIZE = 8;
const LABEL_GAP = 8;
const DATE_GAP = 4;
const LABEL_LINE_HEIGHT = 16;
export const LABEL_MARGIN_X = 12;
export const LANE_TOP_Y = DOT_SIZE / 2 + LABEL_GAP + LABEL_LINE_HEIGHT;
export const LANE_GAP = DOT_SIZE + DATE_GAP + LABEL_LINE_HEIGHT + LABEL_GAP + LABEL_LINE_HEIGHT;
export const LANE_BOTTOM_PAD = DOT_SIZE / 2 + DATE_GAP + LABEL_LINE_HEIGHT;

export const CHIP_BASE = "rounded-md px-1.5 font-mono text-2xs font-bold tabular-nums";
export const ADD_CHIP = "bg-success-soft text-success";
export const CUT_CHIP = "bg-destructive-soft text-destructive";
export const CHANGE_CHIP = "bg-warning-soft text-warning";

export function initialRailScroll({
  nodeCenter,
  labelHalfWidth,
  viewportWidth,
  contentWidth,
}: {
  nodeCenter: number;
  labelHalfWidth: number;
  viewportWidth: number;
  contentWidth: number;
}): number {
  const inView = nodeCenter - labelHalfWidth >= 0 && nodeCenter + labelHalfWidth <= viewportWidth;
  if (contentWidth <= viewportWidth || inView) {
    return 0;
  }
  return clamp(nodeCenter - viewportWidth / 2, 0, contentWidth - viewportWidth);
}

export const CHIP_PAIR_WIDTH = 40;
export const CHIP_PAIR_HEIGHT = 34;
// The current node's dot grows a 4 px ring, so its hit box is the widest dot.
export const NODE_BOX = DOT_SIZE + 8;
const CHIP_STEP = 0.05;

// The "New variant" button is `size-8`.
export const NEW_VARIANT_BOX = 32;
// An upper bound for one `text-2xs` glyph; the label's real width is not known before layout.
const LABEL_CHAR_WIDTH = 7;
const DRAFT_BADGE_WIDTH = 41;

interface RailPoint {
  x: number;
  y: number;
}

export interface RailBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

type Box = RailBox;

export function railNodeBoxes(
  point: RailPoint,
  label: { text: string; isDraft: boolean; maxWidth: number },
): RailBox[] {
  const textWidth = Math.min(
    label.maxWidth,
    label.text.length * LABEL_CHAR_WIDTH + (label.isDraft ? DRAFT_BADGE_WIDTH : 0),
  );
  return [
    { left: point.x, top: point.y, width: NODE_BOX, height: NODE_BOX },
    {
      left: point.x,
      top: point.y - DOT_SIZE / 2 - LABEL_GAP - LABEL_LINE_HEIGHT / 2,
      width: textWidth,
      height: LABEL_LINE_HEIGHT,
    },
  ];
}

export function newVariantBox(point: RailPoint): RailBox {
  return { left: point.x, top: point.y, width: NEW_VARIANT_BOX, height: NEW_VARIANT_BOX };
}

/** The first lane at the next column that no node holds, so the button never sits on a child. */
export function newVariantSlot(
  current: { x: number; lane: number },
  nodes: readonly { x: number; lane: number }[],
): { x: number; lane: number } {
  const x = current.x + 1;
  const taken = new Set(nodes.filter((node) => node.x === x).map((node) => node.lane));
  let lane = current.lane;
  while (taken.has(lane)) {
    lane += 1;
  }
  return { x, lane };
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return (
    Math.abs(a.left - b.left) * 2 < a.width + b.width &&
    Math.abs(a.top - b.top) * 2 < a.height + b.height
  );
}

function edgePoint(from: RailPoint, to: RailPoint, t: number): { left: number; top: number } {
  if (from.y === to.y) {
    return { left: from.x + (to.x - from.x) * t, top: from.y };
  }
  const bend = (to.x - from.x) / 2;
  const u = 1 - t;
  const cubic = (p0: number, p1: number, p2: number, p3: number) =>
    u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  return {
    left: cubic(from.x, from.x + bend, to.x - bend, to.x),
    top: cubic(from.y, from.y, to.y, to.y),
  };
}

function stepsFromMiddle(): number[] {
  const steps = [0.5];
  for (let offset = CHIP_STEP; offset < 0.5; offset += CHIP_STEP) {
    steps.push(0.5 - offset, 0.5 + offset);
  }
  return steps;
}

/** A chip pair that has no clear spot on its edge is left out of the map. */
export function edgeChipCenters(
  edges: readonly { fromId: string; toId: string }[],
  pointOf: (id: string) => RailPoint | undefined,
  obstacles: readonly RailBox[],
): Map<string, { left: number; top: number }> {
  const nodeBoxes = obstacles;
  const placed: Box[] = [];
  const centers = new Map<string, { left: number; top: number }>();
  for (const siblings of Map.groupBy(edges, (edge) => edge.fromId).values()) {
    const ends = siblings.flatMap((edge) => {
      const from = pointOf(edge.fromId);
      const to = pointOf(edge.toId);
      return from && to ? [{ edge, from, to }] : [];
    });
    for (const { edge, from, to } of ends.toSorted((a, b) => a.to.y - b.to.y || a.to.x - b.to.x)) {
      for (const t of stepsFromMiddle()) {
        const center = edgePoint(from, to, t);
        const box = { ...center, width: CHIP_PAIR_WIDTH, height: CHIP_PAIR_HEIGHT };
        if ([...nodeBoxes, ...placed].some((other) => boxesOverlap(box, other))) {
          continue;
        }
        placed.push(box);
        centers.set(`${edge.fromId}-${edge.toId}`, center);
        break;
      }
    }
  }
  return centers;
}
