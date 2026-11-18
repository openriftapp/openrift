import type { Active, Over } from "@dnd-kit/core";
import { labelMapOf } from "@openrift/shared/enum-label";
import { describe, expect, it } from "vitest";

import { stubDeckBuilderCard } from "@/test/factories";

import type { DeckDragData, DeckDropData } from "./deck-dnd-data";
import { deckDragAnnouncements } from "./deck-drag-announcements";

function active(data: DeckDragData): Active {
  return {
    id: "drag-1",
    data: { current: data as unknown as Record<string, unknown> },
    rect: { current: { initial: null, translated: null } },
  };
}

function over(data: DeckDropData): Over {
  return {
    id: `zone-${data.zone}`,
    data: { current: data as unknown as Record<string, unknown> },
    rect: { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 },
    disabled: false,
  };
}

const announcements = deckDragAnnouncements(
  labelMapOf({ main: "Main Deck", sideboard: "Sideboard" }),
);

const row = active({
  type: "deck-card",
  cardId: "card-1",
  cardName: "Annie, Fiery",
  fromZone: "main",
  quantity: 2,
  preferredPrintingId: null,
});

describe("deckDragAnnouncements", () => {
  it("names a deck row and the zone it moves to", () => {
    expect(announcements.onDragStart({ active: row })).toBe("Picked up Annie, Fiery.");
    expect(
      announcements.onDragOver?.({
        active: row,
        over: over({ type: "deck-zone", zone: "sideboard" }),
      }),
    ).toBe("Annie, Fiery is over Sideboard.");
    expect(
      announcements.onDragEnd({
        active: row,
        over: over({ type: "deck-zone", zone: "sideboard" }),
      }),
    ).toBe("Dropped Annie, Fiery on Sideboard.");
  });

  it("names a browser card by its legend display name", () => {
    const browser = active({
      type: "browser-card",
      card: stubDeckBuilderCard({
        cardName: "Emperor of the Sands",
        cardTypes: ["legend"],
        tags: ["Azir"],
      }),
    });
    expect(announcements.onDragStart({ active: browser })).toBe(
      "Picked up Azir, Emperor of the Sands.",
    );
  });

  it("treats the zone the row came from as no target", () => {
    expect(
      announcements.onDragEnd({ active: row, over: over({ type: "deck-zone", zone: "main" }) }),
    ).toBe("Dropped Annie, Fiery. Nothing moved.");
  });
});
