// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import type { DeckDropData } from "@/features/decks/lib/deck-dnd-data";

import { releaseDropTarget, zoneAtPoint } from "./deck-dnd-context";

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
