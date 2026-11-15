import { describe, expect, it } from "vitest";

import {
  CHIP_PAIR_HEIGHT,
  CHIP_PAIR_WIDTH,
  LABEL_MARGIN_X,
  NODE_BOX,
  boxesOverlap,
  newVariantBox,
  newVariantSlot,
  railNodeBoxes,
  LANE_GAP,
  LANE_TOP_Y,
  PHONE_SLOT_WIDTH,
  SLOT_WIDTH,
  edgeChipCenters,
  initialRailScroll,
} from "./deck-variant-rail-geometry";

describe("initialRailScroll", () => {
  const labelHalfWidth = 60;

  it("opens unscrolled when the whole rail fits", () => {
    expect(
      initialRailScroll({ nodeCenter: 300, labelHalfWidth, viewportWidth: 400, contentWidth: 384 }),
    ).toBe(0);
  });

  it("opens unscrolled when the current variant is already in view", () => {
    expect(
      initialRailScroll({ nodeCenter: 192, labelHalfWidth, viewportWidth: 351, contentWidth: 384 }),
    ).toBe(0);
  });

  it("centres a current variant that would start out of view", () => {
    expect(
      initialRailScroll({ nodeCenter: 600, labelHalfWidth, viewportWidth: 350, contentWidth: 900 }),
    ).toBe(425);
  });

  it("never scrolls past the end of the rail", () => {
    expect(
      initialRailScroll({ nodeCenter: 850, labelHalfWidth, viewportWidth: 350, contentWidth: 900 }),
    ).toBe(550);
  });
});

describe("rail hit boxes", () => {
  const labelWidth = (slot: number) => slot - LABEL_MARGIN_X;

  function family(slot: number, childCount: number, label: (index: number) => string) {
    const current = { id: "root", x: 0, lane: 0, label: "Aggro" };
    const children = Array.from({ length: childCount }, (_, lane) => ({
      id: `child-${lane}`,
      x: 1,
      lane,
      label: label(lane),
    }));
    const nodes = [current, ...children];
    const point = (node: { x: number; lane: number }) => ({
      x: labelWidth(slot) / 2 + node.x * slot,
      y: LANE_TOP_Y + node.lane * LANE_GAP,
    });
    const ghost = newVariantSlot(current, nodes);
    const nodeBoxes = nodes.flatMap((node) =>
      railNodeBoxes(point(node), { text: node.label, isDraft: false, maxWidth: labelWidth(slot) }),
    );
    const ghostBox = newVariantBox(point(ghost));
    const byId = new Map(nodes.map((node) => [node.id, point(node)]));
    const edges = children.map((child) => ({ fromId: "root", toId: child.id }));
    const chips = [
      ...edgeChipCenters(edges, (id) => byId.get(id), [...nodeBoxes, ghostBox]).values(),
    ].map((center) => ({ ...center, width: CHIP_PAIR_WIDTH, height: CHIP_PAIR_HEIGHT }));
    const dots = nodes.map((node) => ({
      left: point(node).x,
      top: point(node).y,
      width: NODE_BOX,
      height: NODE_BOX,
    }));
    return { nodeBoxes, ghostBox, chips, dots, edges };
  }

  for (const slot of [SLOT_WIDTH, PHONE_SLOT_WIDTH]) {
    for (const childCount of [1, 2, 3, 4]) {
      for (const [name, label] of [
        ["short", (index: number) => `v${index + 2}`],
        ["long", (index: number) => `Shurima Sunday v${index + 2}`],
      ] as const) {
        it(`keeps ${childCount} children, chips and New variant apart at ${slot} px (${name} names)`, () => {
          const { nodeBoxes, ghostBox, chips, dots } = family(slot, childCount, label);
          for (const dot of dots) {
            expect(boxesOverlap(ghostBox, dot)).toBe(false);
          }
          for (const [index, chip] of chips.entries()) {
            for (const other of chips.slice(index + 1)) {
              expect(boxesOverlap(chip, other)).toBe(false);
            }
            for (const box of [...nodeBoxes, ghostBox]) {
              expect(boxesOverlap(chip, box)).toBe(false);
            }
          }
        });
      }
    }
  }

  it("places every chip when the names are short", () => {
    for (const slot of [SLOT_WIDTH, PHONE_SLOT_WIDTH]) {
      for (const childCount of [1, 2, 3, 4]) {
        const { chips, edges } = family(slot, childCount, (index) => `v${index + 2}`);
        expect(chips).toHaveLength(edges.length);
      }
    }
  });

  it("puts New variant on the first free lane of the next column", () => {
    const current = { x: 2, lane: 1 };
    expect(newVariantSlot(current, [current])).toEqual({ x: 3, lane: 1 });
    expect(newVariantSlot(current, [current, { x: 3, lane: 1 }, { x: 3, lane: 2 }])).toEqual({
      x: 3,
      lane: 3,
    });
  });

  it("puts a lone edge's chips at the edge's midpoint", () => {
    for (const slot of [SLOT_WIDTH, PHONE_SLOT_WIDTH]) {
      for (const lane of [0, 1, 2]) {
        const from = { x: slot / 2, y: LANE_TOP_Y };
        const to = { x: slot * 1.5, y: LANE_TOP_Y + lane * LANE_GAP };
        const points = new Map([
          ["a", from],
          ["b", to],
        ]);
        const label = { text: "v2", isDraft: false, maxWidth: slot - LABEL_MARGIN_X };
        const centers = edgeChipCenters([{ fromId: "a", toId: "b" }], (id) => points.get(id), [
          ...railNodeBoxes(from, label),
          ...railNodeBoxes(to, label),
        ]);
        expect(centers.get("a-b")).toEqual({ left: (from.x + to.x) / 2, top: (from.y + to.y) / 2 });
      }
    }
  });

  it("skips an edge whose end is not on the rail", () => {
    const points = new Map([["a", { x: 0, y: 10 }]]);
    expect(edgeChipCenters([{ fromId: "a", toId: "gone" }], (id) => points.get(id), []).size).toBe(
      0,
    );
  });
});
