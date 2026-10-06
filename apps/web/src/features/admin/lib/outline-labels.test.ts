import { describe, expect, it } from "vitest";

import type { FrameOutlineLabel, OutlineLabelQuad } from "./outline-labels";
import {
  addCard,
  doneCount,
  outlineLabelFolder,
  outlineLabelMargin,
  outlineLabelStorageKey,
  outlineLabelsFromProposals,
  outlineLabelsFromSaved,
  mergeOpenedOutlineLabels,
  moveCard,
  moveCorner,
  removeCard,
  serializeOutlineLabels,
  serializeStoredOutlineLabels,
  storedOutlineLabelsFor,
} from "./outline-labels";

const quad: OutlineLabelQuad = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 14 },
  { x: 0, y: 14 },
];

describe("outlineLabelsFromProposals", () => {
  it("turns pre-drawn outlines into labels that still need checking", () => {
    expect(outlineLabelsFromProposals({ version: 1, frames: { "a.jpg": [quad] } })).toEqual({
      "a.jpg": { cards: [quad], done: false },
    });
  });

  it("drops malformed outlines and survives a malformed file", () => {
    expect(
      outlineLabelsFromProposals({ frames: { "a.jpg": [quad, [{ x: 1 }]] } })["a.jpg"]?.cards,
    ).toEqual([quad]);
    expect(outlineLabelsFromProposals(null)).toEqual({});
  });
});

describe("outlineLabelsFromSaved", () => {
  it("restores cards and done flags from a saved file", () => {
    const saved = JSON.parse(serializeOutlineLabels({ "a.jpg": { cards: [quad], done: true } }));
    expect(outlineLabelsFromSaved(saved)).toEqual({ "a.jpg": { cards: [quad], done: true } });
  });
});

describe("outlineLabelMargin", () => {
  const size = { width: 300, height: 600 };

  it("leaves a third of the long side around a frame whose outlines lie inside", () => {
    expect(outlineLabelMargin([quad], size)).toBe(200);
  });

  it("grows to reach a corner drawn past the frame's edge", () => {
    const cutOff: OutlineLabelQuad = [
      { x: -150, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 640 },
      { x: -150, y: 640 },
    ];
    expect(outlineLabelMargin([cutOff], size)).toBe(350);
  });
});

describe("opening a folder", () => {
  const proposed = { cards: [quad], done: false };
  const stored = { cards: [], done: true };
  const saved = { cards: [quad, quad], done: true };

  it("tells folders with the same frame names apart by file size", () => {
    const a = outlineLabelFolder([{ name: "0001.jpg", size: 10 }]);
    const b = outlineLabelFolder([{ name: "0001.jpg", size: 11 }]);
    expect(a).not.toBe(b);
    expect(outlineLabelStorageKey(a)).not.toBe(outlineLabelStorageKey(b));
  });

  it("ignores frame order", () => {
    expect(
      outlineLabelFolder([
        { name: "b.jpg", size: 1 },
        { name: "a.jpg", size: 2 },
      ]),
    ).toBe(
      outlineLabelFolder([
        { name: "a.jpg", size: 2 },
        { name: "b.jpg", size: 1 },
      ]),
    );
  });

  it("restores the autosave of the same folder", () => {
    const json = JSON.parse(serializeStoredOutlineLabels("one", { "a.jpg": stored }));
    expect(storedOutlineLabelsFor(json, "one")).toEqual({ "a.jpg": stored });
  });

  it("ignores an autosave written for another folder", () => {
    const json = JSON.parse(serializeStoredOutlineLabels("one", { "a.jpg": stored }));
    expect(storedOutlineLabelsFor(json, "two")).toEqual({});
    expect(storedOutlineLabelsFor(null, "two")).toEqual({});
  });

  it("lets the autosave win over proposals", () => {
    expect(mergeOpenedOutlineLabels({ "a.jpg": proposed }, { "a.jpg": stored }, {})).toEqual({
      labels: { "a.jpg": stored },
      keptAutosave: 0,
    });
  });

  it("keeps the autosave over an opened scan-labels.json and counts the frames", () => {
    expect(
      mergeOpenedOutlineLabels(
        { "a.jpg": proposed },
        { "a.jpg": stored, "b.jpg": stored },
        { "a.jpg": saved, "b.jpg": stored, "c.jpg": saved },
      ),
    ).toEqual({
      labels: { "a.jpg": stored, "b.jpg": stored, "c.jpg": saved },
      keptAutosave: 1,
    });
  });

  it("keeps proposals for frames nothing else covers", () => {
    expect(mergeOpenedOutlineLabels({ "b.jpg": proposed }, { "a.jpg": stored }, {})).toEqual({
      labels: { "a.jpg": stored, "b.jpg": proposed },
      keptAutosave: 0,
    });
  });
});

describe("editing", () => {
  const label: FrameOutlineLabel = { cards: [quad], done: false };

  it("moves one corner of one card", () => {
    const moved = moveCorner(label, 0, 2, { x: 12, y: 15 });
    expect(moved.cards[0]?.[2]).toEqual({ x: 12, y: 15 });
    expect(moved.cards[0]?.[0]).toEqual({ x: 0, y: 0 });
    expect(label.cards[0]?.[2]).toEqual({ x: 10, y: 14 });
  });

  it("moves a whole card from where the drag started, keeping its shape", () => {
    const first = moveCard(label, 0, quad, { x: 3, y: 1 });
    const moved = moveCard(first, 0, quad, { x: 5, y: -2 });
    expect(moved.cards[0]).toEqual(quad.map((point) => ({ x: point.x + 5, y: point.y - 2 })));
    expect(label.cards[0]).toEqual(quad);
  });

  it("adds an upright card outline in the middle of the image", () => {
    const added = addCard(label, 1000, 500);
    const card = added.cards[1];
    expect(added.cards).toHaveLength(2);
    expect(card?.[3].y && card[0].y ? card[3].y - card[0].y : 0).toBeCloseTo(100, 6);
  });

  it("removes a card", () => {
    expect(removeCard(label, 0).cards).toEqual([]);
  });

  it("counts finished frames", () => {
    expect(doneCount({ a: { cards: [], done: true }, b: { cards: [quad], done: false } })).toBe(1);
  });
});
