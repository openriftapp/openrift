import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { beforeEach, describe, expect, it } from "vitest";

import { isZoneDropRejected } from "@/features/decks/hooks/use-deck-zone-drop";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import type { DeckCardDragData } from "@/features/decks/lib/deck-dnd-data";
import { resetIdCounter, stubDeckBuilderCard } from "@/test/factories";

beforeEach(() => {
  resetIdCounter();
});

function dragOf(card: DeckBuilderCard): DeckCardDragData {
  return {
    type: "deck-card",
    cardId: card.cardId,
    cardName: card.cardName,
    fromZone: card.zone,
    quantity: card.quantity,
    preferredPrintingId: card.preferredPrintingId,
  };
}

describe("isZoneDropRejected", () => {
  it("rejects nothing while no drag is in flight", () => {
    expect(
      isZoneDropRejected({
        dragData: undefined,
        zone: WellKnown.deckZone.MAIN,
        allCards: [],
        format: WellKnown.deckFormat.CONSTRUCTED,
      }),
    ).toBe(false);
  });

  it("rejects nothing when the dragged entry can't be found in the deck", () => {
    const card = stubDeckBuilderCard({ zone: WellKnown.deckZone.MAIN });
    expect(
      isZoneDropRejected({
        dragData: dragOf(card),
        zone: WellKnown.deckZone.MAIN,
        allCards: [],
        format: WellKnown.deckFormat.CONSTRUCTED,
      }),
    ).toBe(false);
  });

  it("accepts a unit moving into the main deck", () => {
    const card = stubDeckBuilderCard({ zone: WellKnown.deckZone.OVERFLOW, cardType: "unit" });
    expect(
      isZoneDropRejected({
        dragData: dragOf(card),
        zone: WellKnown.deckZone.MAIN,
        allCards: [card],
        format: WellKnown.deckFormat.CONSTRUCTED,
      }),
    ).toBe(false);
  });

  it("rejects a card the zone's type gate turns away", () => {
    const unit = stubDeckBuilderCard({ zone: WellKnown.deckZone.MAIN, cardType: "unit" });
    expect(
      isZoneDropRejected({
        dragData: dragOf(unit),
        zone: WellKnown.deckZone.RUNES,
        allCards: [unit],
        format: WellKnown.deckFormat.CONSTRUCTED,
      }),
    ).toBe(true);
  });

  it("rejects a drop that would break the copy cap", () => {
    const parked = stubDeckBuilderCard({ zone: WellKnown.deckZone.OVERFLOW, cardType: "unit" });
    const held = stubDeckBuilderCard({
      cardId: parked.cardId,
      zone: WellKnown.deckZone.MAIN,
      quantity: 3,
    });
    expect(
      isZoneDropRejected({
        dragData: dragOf(parked),
        zone: WellKnown.deckZone.MAIN,
        allCards: [parked, held],
        format: WellKnown.deckFormat.CONSTRUCTED,
      }),
    ).toBe(true);
  });

  it("rejects a second copy of a battlefield already on the field", () => {
    const battlefield = stubDeckBuilderCard({
      zone: WellKnown.deckZone.BATTLEFIELD,
      cardType: "battlefield",
    });
    expect(
      isZoneDropRejected({
        dragData: dragOf(battlefield),
        zone: WellKnown.deckZone.BATTLEFIELD,
        allCards: [battlefield],
        format: WellKnown.deckFormat.CONSTRUCTED,
      }),
    ).toBe(true);
  });

  it("rejects a rune once the twelve-rune cap is reached", () => {
    const rune = stubDeckBuilderCard({
      zone: WellKnown.deckZone.RUNES,
      cardType: "rune",
      quantity: 12,
    });
    expect(
      isZoneDropRejected({
        dragData: dragOf(rune),
        zone: WellKnown.deckZone.RUNES,
        allCards: [rune],
        format: WellKnown.deckFormat.CONSTRUCTED,
      }),
    ).toBe(true);
  });

  it("keeps the capacity caps out of freeform", () => {
    const parked = stubDeckBuilderCard({ zone: WellKnown.deckZone.OVERFLOW, cardType: "unit" });
    const held = stubDeckBuilderCard({
      cardId: parked.cardId,
      zone: WellKnown.deckZone.MAIN,
      quantity: 3,
    });
    expect(
      isZoneDropRejected({
        dragData: dragOf(parked),
        zone: WellKnown.deckZone.MAIN,
        allCards: [parked, held],
        format: WellKnown.deckFormat.FREEFORM,
      }),
    ).toBe(false);
  });

  it("reads a card dragged in from the browser off the payload itself", () => {
    const card = stubDeckBuilderCard({ cardType: "unit" });
    expect(
      isZoneDropRejected({
        dragData: { type: "browser-card", card },
        zone: WellKnown.deckZone.RUNES,
        allCards: [],
        format: WellKnown.deckFormat.CONSTRUCTED,
      }),
    ).toBe(true);
  });

  describe("relaxed", () => {
    it("accepts a drop that would break the copy cap", () => {
      const parked = stubDeckBuilderCard({ zone: WellKnown.deckZone.OVERFLOW, cardType: "unit" });
      const held = stubDeckBuilderCard({
        cardId: parked.cardId,
        zone: WellKnown.deckZone.MAIN,
        quantity: 3,
      });
      expect(
        isZoneDropRejected({
          dragData: dragOf(parked),
          zone: WellKnown.deckZone.MAIN,
          allCards: [parked, held],
          format: WellKnown.deckFormat.CONSTRUCTED,
          relaxed: true,
        }),
      ).toBe(false);
    });

    it("accepts a browser battlefield onto a full field", () => {
      const field = [1, 2, 3].map(() =>
        stubDeckBuilderCard({ zone: WellKnown.deckZone.BATTLEFIELD, cardType: "battlefield" }),
      );
      const incoming = stubDeckBuilderCard({ cardType: "battlefield" });
      expect(
        isZoneDropRejected({
          dragData: { type: "browser-card", card: incoming },
          zone: WellKnown.deckZone.BATTLEFIELD,
          allCards: field,
          format: WellKnown.deckFormat.CONSTRUCTED,
          relaxed: true,
        }),
      ).toBe(false);
    });

    it("accepts a rune past the twelve-rune cap", () => {
      const rune = stubDeckBuilderCard({
        zone: WellKnown.deckZone.RUNES,
        cardType: "rune",
        quantity: 12,
      });
      expect(
        isZoneDropRejected({
          dragData: { type: "browser-card", card: rune },
          zone: WellKnown.deckZone.RUNES,
          allCards: [rune],
          format: WellKnown.deckFormat.CONSTRUCTED,
          relaxed: true,
        }),
      ).toBe(false);
    });

    it("still rejects a card the zone's type gate turns away", () => {
      const unit = stubDeckBuilderCard({ zone: WellKnown.deckZone.MAIN, cardType: "unit" });
      expect(
        isZoneDropRejected({
          dragData: dragOf(unit),
          zone: WellKnown.deckZone.RUNES,
          allCards: [unit],
          format: WellKnown.deckFormat.CONSTRUCTED,
          relaxed: true,
        }),
      ).toBe(true);
    });

    it("still rejects a sideboard drop in a format without one", () => {
      const unit = stubDeckBuilderCard({ zone: WellKnown.deckZone.MAIN, cardType: "unit" });
      expect(
        isZoneDropRejected({
          dragData: dragOf(unit),
          zone: WellKnown.deckZone.SIDEBOARD,
          allCards: [unit],
          format: WellKnown.deckFormat.CUSTOM_REGION,
          relaxed: true,
        }),
      ).toBe(true);
    });
  });

  describe("a rune dragged from the browser onto a full rune deck", () => {
    const rune = (domain: string, quantity: number, zone: DeckZone = WellKnown.deckZone.RUNES) =>
      stubDeckBuilderCard({ cardType: "rune", zone, domains: [domain] as never, quantity });
    const legend = (domains: string[]) =>
      stubDeckBuilderCard({
        cardType: "legend",
        zone: WellKnown.deckZone.LEGEND,
        domains: domains as never,
      });
    const drop = (allCards: DeckBuilderCard[]) =>
      isZoneDropRejected({
        dragData: { type: "browser-card", card: rune("fury", 1, WellKnown.deckZone.MAIN) },
        zone: WellKnown.deckZone.RUNES,
        allCards,
        format: WellKnown.deckFormat.CONSTRUCTED,
      });

    it("accepts it when a two-domain legend lets it swap a rune out", () => {
      expect(drop([legend(["fury", "calm"]), rune("fury", 6), rune("calm", 6)])).toBe(false);
    });

    it("rejects it without a legend", () => {
      expect(drop([rune("fury", 12)])).toBe(true);
    });

    it("rejects it under a single-domain legend", () => {
      expect(drop([legend(["fury"]), rune("fury", 12)])).toBe(true);
    });
  });
});
