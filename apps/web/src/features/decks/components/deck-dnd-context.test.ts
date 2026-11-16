// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import type { DeckDropData } from "@/features/decks/lib/deck-dnd-data";

import { edgeScrollDelta, isPointInRect, releaseDropTarget, zoneAtPoint } from "./deck-dnd-context";

// A 500px-tall container showing 500 of 1500px, scrolled to the middle.
function container(overrides?: Partial<Parameters<typeof edgeScrollDelta>[0]>) {
  return {
    pointerY: 250,
    top: 0,
    bottom: 500,
    scrollTop: 500,
    scrollHeight: 1500,
    clientHeight: 500,
    ...overrides,
  };
}

describe("edgeScrollDelta", () => {
  it("stays still while the pointer is away from both edges", () => {
    expect(edgeScrollDelta(container())).toBe(0);
  });

  it("scrolls up near the top edge", () => {
    expect(edgeScrollDelta(container({ pointerY: 10 }))).toBeLessThan(0);
  });

  it("scrolls down near the bottom edge", () => {
    expect(edgeScrollDelta(container({ pointerY: 490 }))).toBeGreaterThan(0);
  });

  it("speeds up the closer the pointer gets to an edge", () => {
    const near = edgeScrollDelta(container({ pointerY: 495 }));
    const far = edgeScrollDelta(container({ pointerY: 470 }));
    expect(near).toBeGreaterThan(far);
  });

  it("caps the speed for a pointer past the edge", () => {
    const atEdge = edgeScrollDelta(container({ pointerY: 500 }));
    const beyond = edgeScrollDelta(container({ pointerY: 900 }));
    expect(beyond).toBe(atEdge);
  });

  it("does not scroll up when already at the top", () => {
    expect(edgeScrollDelta(container({ pointerY: 10, scrollTop: 0 }))).toBe(0);
  });

  it("does not scroll down when already at the bottom", () => {
    expect(edgeScrollDelta(container({ pointerY: 490, scrollTop: 1000 }))).toBe(0);
  });

  it("ignores containers with nothing to scroll", () => {
    expect(edgeScrollDelta(container({ pointerY: 490, scrollTop: 0, scrollHeight: 500 }))).toBe(0);
  });
});

describe("isPointInRect", () => {
  const rect = { top: 100, right: 400, bottom: 300, left: 200 };

  it("accepts a point inside", () => {
    expect(isPointInRect(300, 200, rect)).toBe(true);
  });

  it("accepts a point on the edge", () => {
    expect(isPointInRect(200, 100, rect)).toBe(true);
  });

  it("rejects points outside on every side", () => {
    expect(isPointInRect(199, 200, rect)).toBe(false);
    expect(isPointInRect(401, 200, rect)).toBe(false);
    expect(isPointInRect(300, 99, rect)).toBe(false);
    expect(isPointInRect(300, 301, rect)).toBe(false);
  });
});

function docWithElementsAt(elements: Element[]): Document {
  return { elementsFromPoint: () => elements } as unknown as Document;
}

function zoneElement(zone: string): HTMLElement {
  const element = document.createElement("section");
  element.dataset.deckDropZone = zone;
  element.append(document.createElement("span"));
  return element;
}

describe("zoneAtPoint", () => {
  it("finds the zone container around the element under the point", () => {
    const zone = zoneElement("sideboard");
    const inner = zone.firstElementChild as Element;
    expect(zoneAtPoint({ x: 10, y: 10 }, docWithElementsAt([inner, zone]))).toBe("sideboard");
  });

  it("is null outside every zone, for an unknown zone name and without a point", () => {
    const outside = document.createElement("main");
    expect(zoneAtPoint({ x: 10, y: 10 }, docWithElementsAt([outside]))).toBeNull();
    expect(zoneAtPoint({ x: 10, y: 10 }, docWithElementsAt([zoneElement("attic")]))).toBeNull();
    expect(zoneAtPoint(null, docWithElementsAt([zoneElement("main")]))).toBeNull();
  });
});

describe("releaseDropTarget", () => {
  const accepts = () => false;

  it("keeps dnd-kit's target when it has one", () => {
    const over: DeckDropData = { type: "deck-zone", zone: "main" };
    expect(releaseDropTarget(over, "sideboard", accepts)).toBe(over);
  });

  it("drops onto the zone under the pointer when dnd-kit has not resolved a target yet", () => {
    expect(releaseDropTarget(undefined, "sideboard", accepts)).toEqual({
      type: "deck-zone",
      zone: "sideboard",
      disabled: false,
    });
  });

  it("marks a zone under the pointer that refuses the card", () => {
    expect(releaseDropTarget(undefined, "runes", () => true)).toEqual({
      type: "deck-zone",
      zone: "runes",
      disabled: true,
    });
  });

  it("is a drop outside when no zone is under the pointer", () => {
    const gap = document.createElement("div");
    expect(
      releaseDropTarget(
        undefined,
        zoneAtPoint({ x: 5, y: 700 }, docWithElementsAt([gap])),
        accepts,
      ),
    ).toBeNull();
  });
});
