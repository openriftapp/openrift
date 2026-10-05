import { describe, expect, it } from "vitest";

import { createTablePlaces, onCountedPlace, placeFor, shiftTable } from "./table-places";
import type { Quad } from "./types";

const frame = { width: 480, height: 848 };

const card = (x: number, y: number, half = 60): Quad => [
  { x: x - half, y: y - half * 1.4 },
  { x: x + half, y: y - half * 1.4 },
  { x: x + half, y: y + half * 1.4 },
  { x: x - half, y: y + half * 1.4 },
];

describe("placeFor", () => {
  it("keeps one place for a card whose outline jitters", () => {
    const places = createTablePlaces();
    const first = placeFor(places, "ahri", card(200, 400), frame);
    const second = placeFor(places, "ahri", card(212, 395, 66), frame);
    expect(second).toBe(first);
  });

  it("gives a second copy beside the first its own place", () => {
    const places = createTablePlaces();
    const left = placeFor(places, "ahri", card(120, 400), frame);
    const right = placeFor(places, "ahri", card(260, 400), frame);
    expect(right?.key).not.toBe(left?.key);
  });

  it("finds a card again after the camera panned away and back", () => {
    const places = createTablePlaces();
    const first = placeFor(places, "ahri", card(200, 400), frame);
    shiftTable(places, { x: -300, y: 0 });
    shiftTable(places, { x: 300, y: 0 });
    expect(placeFor(places, "ahri", card(205, 400), frame)).toBe(first);
  });

  it("follows the camera, so the same card at a new frame position is still one place", () => {
    const places = createTablePlaces();
    const first = placeFor(places, "ahri", card(300, 400), frame);
    shiftTable(places, { x: -150, y: 0 });
    expect(placeFor(places, "ahri", card(150, 400), frame)).toBe(first);
  });

  it("re-anchors a place on each whole sighting, so tracking error does not add up", () => {
    const places = createTablePlaces();
    const first = placeFor(places, "ahri", card(200, 400), frame);
    for (let step = 1; step <= 6; step++) {
      shiftTable(places, { x: 0, y: 0 });
      expect(placeFor(places, "ahri", card(200 + step * 20, 400), frame)).toBe(first);
    }
  });

  it("does not start a place from a card cut off by the frame edge", () => {
    const places = createTablePlaces();
    expect(placeFor(places, "ahri", card(20, 400), frame)).toBeNull();
  });

  it("keeps different artworks apart at the same spot", () => {
    const places = createTablePlaces();
    const ahri = placeFor(places, "ahri", card(200, 400), frame);
    const jinx = placeFor(places, "jinx", card(200, 400), frame);
    expect(jinx?.key).not.toBe(ahri?.key);
  });

  it("tells counted places apart from new ones", () => {
    const places = createTablePlaces();
    const first = placeFor(places, "ahri", card(120, 400), frame);
    const counted = new Set(first ? [first.key] : []);
    expect(onCountedPlace(places, counted, card(125, 400))).toBe(true);
    expect(onCountedPlace(places, counted, card(300, 400))).toBe(false);
  });
});
