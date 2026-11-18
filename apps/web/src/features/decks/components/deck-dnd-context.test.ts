// @vitest-environment happy-dom
import { deckCardKey } from "@openrift/shared/deck-cards";
import { createCollection, localOnlyCollectionOptions } from "@tanstack/react-db";
import { describe, expect, it, vi } from "vitest";

import { moveCardAction } from "@/features/decks/hooks/use-deck-builder";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import type { DeckDropData } from "@/features/decks/lib/deck-dnd-data";
import { showRelaxedAddToast } from "@/features/decks/lib/workbench-add-toast";
import { stubDeckBuilderCard } from "@/test/factories";

import { dropDeckCard, releaseDropTarget, zoneAtPoint } from "./deck-dnd-context";

vi.mock("@/features/decks/lib/workbench-add-toast", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  showRelaxedAddToast: vi.fn(),
}));

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

describe("dropDeckCard", () => {
  it("warns about and undoes only the copies that fit under the row cap", () => {
    const row = (zone: DeckBuilderCard["zone"], quantity: number) =>
      stubDeckBuilderCard({
        cardId: "card-1",
        cardType: "unit",
        zone,
        quantity,
        preferredPrintingId: null,
      });
    const collection = createCollection(
      localOnlyCollectionOptions<DeckBuilderCard>({
        id: "drop-deck-card",
        getKey: deckCardKey,
        initialData: [row("main", 97), row("overflow", 5)],
      }),
    );
    const move =
      (amount: "all" | "one") =>
      (
        cardId: string,
        from: DeckBuilderCard["zone"],
        to: DeckBuilderCard["zone"],
        printing: string | null,
      ) =>
        moveCardAction(collection, cardId, from, to, printing, "constructed", amount).moved;
    const quantities = () =>
      Object.fromEntries([...collection.values()].map((card) => [card.zone, card.quantity]));

    dropDeckCard({
      data: {
        type: "deck-card",
        cardId: "card-1",
        cardName: "Test Card",
        fromZone: "overflow",
        quantity: 5,
        preferredPrintingId: null,
      },
      toZone: "main",
      moveAll: true,
      relaxed: true,
      deckCards: [...collection.values()],
      format: "constructed",
      actions: { moveCard: move("all"), moveOneCard: move("one") },
    });

    expect(quantities()).toEqual({ main: 99, overflow: 3 });
    const [outcome, handlers] = vi.mocked(showRelaxedAddToast).mock.calls[0] ?? [];
    expect(outcome).toMatchObject({ rule: "copyLimit", quantity: 2, total: 99 });
    handlers?.undo();
    expect(quantities()).toEqual({ main: 97, overflow: 5 });
  });
});
