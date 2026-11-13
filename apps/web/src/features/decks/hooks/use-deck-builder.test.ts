import type { Domain } from "@openrift/shared/types/enums";
import type { Collection } from "@tanstack/react-db";
import { createCollection, localOnlyCollectionOptions } from "@tanstack/react-db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { canAddRune, deckCardKey } from "@/features/decks/lib/deck-builder-card";
import { useDeckUndoStore } from "@/features/decks/stores/deck-undo-store";
import { resetIdCounter, stubDeckBuilderCard } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

import {
  addCardAction,
  changePreferredPrintingAction,
  moveCardAction,
  moveOneCardAction,
  recordDeckEdit,
  removeCardAction,
  replaceCardAction,
  setLegendAction,
  setQuantityAction,
  undoRelaxedAddAction,
} from "./use-deck-builder";

type DeckCollection = Collection<DeckBuilderCard, string | number>;

function createDraftCollection(initial: DeckBuilderCard[] = []): DeckCollection {
  return createCollection(
    localOnlyCollectionOptions<DeckBuilderCard>({
      id: `test-${Math.random().toString(36).slice(2)}`,
      getKey: deckCardKey,
      initialData: initial,
    }),
  );
}

function cardsOf(collection: DeckCollection): DeckBuilderCard[] {
  return [...collection.values()];
}

const EMPTY_RUNES = new Map<string, DeckBuilderCard[]>();

let collection: DeckCollection;

beforeEach(() => {
  resetIdCounter();
  collection = createDraftCollection();
});

afterEach(() => {
  void collection.cleanup();
});

describe("addCardAction", () => {
  it("adds a card to the target zone", () => {
    const card = stubDeckBuilderCard({ cardType: "unit" });
    addCardAction(collection, card, "main", undefined, EMPTY_RUNES, "constructed");
    const cards = cardsOf(collection);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.zone).toBe("main");
    expect(cards[0]!.quantity).toBe(1);
  });

  it("adds to an explicit zone override", () => {
    const card = stubDeckBuilderCard({ cardType: "unit" });
    addCardAction(collection, card, "sideboard", undefined, EMPTY_RUNES, "constructed");
    expect(cardsOf(collection)[0]!.zone).toBe("sideboard");
  });

  it("rejects cards that don't belong in the target zone", () => {
    const legend = stubDeckBuilderCard({ cardType: "legend" });
    addCardAction(collection, legend, "main", undefined, EMPTY_RUNES, "constructed");
    expect(cardsOf(collection)).toHaveLength(0);
  });

  it("increments quantity for an existing entry", () => {
    const card = stubDeckBuilderCard({ cardId: "card-1", cardType: "unit", zone: "main" });
    collection = createDraftCollection([{ ...card, quantity: 1 }]);
    addCardAction(collection, card, "main", undefined, EMPTY_RUNES, "constructed");
    expect(cardsOf(collection)[0]!.quantity).toBe(2);
  });

  it("enforces max 3 copies across main/sideboard/champion", () => {
    const card = stubDeckBuilderCard({
      cardId: "card-1",
      cardType: "unit",
      zone: "main",
      quantity: 3,
    });
    collection = createDraftCollection([card]);
    addCardAction(
      collection,
      { ...card, zone: "sideboard" },
      "sideboard",
      undefined,
      EMPTY_RUNES,
      "constructed",
    );
    const total = cardsOf(collection).reduce((sum, entry) => sum + entry.quantity, 0);
    expect(total).toBe(3);
  });

  it("refuses a second copy of a Unique card in another copy-limit zone", () => {
    const card = stubDeckBuilderCard({
      cardId: "card-1",
      cardType: "unit",
      zone: "main",
      quantity: 1,
      keywords: ["Unique"],
    });
    collection = createDraftCollection([card]);
    addCardAction(
      collection,
      { ...card, zone: "sideboard" },
      "sideboard",
      undefined,
      EMPTY_RUNES,
      "constructed",
    );
    expect(cardsOf(collection)).toHaveLength(1);
  });

  it("skips the copy cap for cards with the unlimited override", () => {
    const card = stubDeckBuilderCard({
      cardId: "card-1",
      cardType: "unit",
      zone: "main",
      quantity: 3,
      maxCopiesOverride: 0,
    });
    collection = createDraftCollection([card]);
    addCardAction(collection, { ...card }, "main", 10, EMPTY_RUNES, "constructed");
    const total = cardsOf(collection).reduce((sum, entry) => sum + entry.quantity, 0);
    expect(total).toBe(13);
  });

  it("clamps against a positive per-card override", () => {
    const card = stubDeckBuilderCard({
      cardId: "card-1",
      cardType: "unit",
      zone: "main",
      quantity: 3,
      maxCopiesOverride: 7,
    });
    collection = createDraftCollection([card]);
    addCardAction(collection, { ...card }, "main", 10, EMPTY_RUNES, "constructed");
    const total = cardsOf(collection).reduce((sum, entry) => sum + entry.quantity, 0);
    expect(total).toBe(7);
  });

  it("does not cap copies added to overflow — it is an unlimited parking zone", () => {
    const card = stubDeckBuilderCard({
      cardId: "card-1",
      cardType: "unit",
      zone: "overflow",
      quantity: 3,
    });
    collection = createDraftCollection([card]);
    addCardAction(collection, { ...card }, "overflow", 5, EMPTY_RUNES, "constructed");
    const overflowTotal = cardsOf(collection)
      .filter((entry) => entry.zone === "overflow")
      .reduce((sum, entry) => sum + entry.quantity, 0);
    expect(overflowTotal).toBe(8);
  });

  it("ignores overflow copies when capping main/sideboard", () => {
    const parked = stubDeckBuilderCard({
      cardId: "card-1",
      cardType: "unit",
      zone: "overflow",
      quantity: 3,
    });
    collection = createDraftCollection([parked]);
    addCardAction(collection, { ...parked, zone: "main" }, "main", 3, EMPTY_RUNES, "constructed");
    const mainTotal = cardsOf(collection)
      .filter((entry) => entry.zone === "main")
      .reduce((sum, entry) => sum + entry.quantity, 0);
    expect(mainTotal).toBe(3);
  });

  it("clamps partial additions up to the 3-copy limit", () => {
    const card = stubDeckBuilderCard({
      cardId: "card-1",
      cardType: "unit",
      zone: "main",
      quantity: 2,
    });
    collection = createDraftCollection([card]);
    addCardAction(
      collection,
      { ...card, zone: "sideboard" },
      "sideboard",
      5,
      EMPTY_RUNES,
      "constructed",
    );
    const total = cardsOf(collection).reduce((sum, entry) => sum + entry.quantity, 0);
    expect(total).toBe(3);
  });

  it("replaces the legend zone when adding a legend", () => {
    const oldLegend = stubDeckBuilderCard({
      cardId: "old",
      cardType: "legend",
      zone: "legend",
    });
    collection = createDraftCollection([oldLegend]);
    const newLegend = stubDeckBuilderCard({ cardId: "new", cardType: "legend" });
    addCardAction(collection, newLegend, "legend", undefined, EMPTY_RUNES, "constructed");
    const legends = cardsOf(collection).filter((c) => c.zone === "legend");
    expect(legends).toHaveLength(1);
    expect(legends[0]!.cardId).toBe("new");
  });

  it("replaces the champion zone when adding a champion", () => {
    const oldChamp = stubDeckBuilderCard({
      cardId: "old-champ",
      cardType: "unit",
      superTypes: ["champion"],
      zone: "champion",
    });
    collection = createDraftCollection([oldChamp]);
    const newChamp = stubDeckBuilderCard({
      cardId: "new-champ",
      cardType: "unit",
      superTypes: ["champion"],
    });
    addCardAction(collection, newChamp, "champion", undefined, EMPTY_RUNES, "constructed");
    const champs = cardsOf(collection).filter((c) => c.zone === "champion");
    expect(champs).toHaveLength(1);
    expect(champs[0]!.cardId).toBe("new-champ");
  });

  it("limits battlefield zone to 3 unique cards", () => {
    const bfs = Array.from({ length: 3 }, (_, index) =>
      stubDeckBuilderCard({
        cardId: `bf-${index}`,
        cardType: "battlefield",
        zone: "battlefield",
        quantity: 1,
      }),
    );
    collection = createDraftCollection(bfs);
    const newBf = stubDeckBuilderCard({ cardId: "bf-new", cardType: "battlefield" });
    addCardAction(collection, newBf, "battlefield", undefined, EMPTY_RUNES, "constructed");
    expect(cardsOf(collection).filter((c) => c.zone === "battlefield")).toHaveLength(3);
  });

  it("limits battlefield zone to 1 card in custom-region", () => {
    const bf = stubDeckBuilderCard({
      cardId: "bf-1",
      cardType: "battlefield",
      zone: "battlefield",
      quantity: 1,
    });
    collection = createDraftCollection([bf]);
    const newBf = stubDeckBuilderCard({ cardId: "bf-new", cardType: "battlefield" });
    addCardAction(collection, newBf, "battlefield", undefined, EMPTY_RUNES, "custom-region");
    const zoneCards = cardsOf(collection).filter((c) => c.zone === "battlefield");
    expect(zoneCards).toHaveLength(1);
    expect(zoneCards[0]!.cardId).toBe("bf-1");
  });

  it("prevents duplicate battlefields in the same zone", () => {
    const bf = stubDeckBuilderCard({
      cardId: "bf-1",
      cardType: "battlefield",
      zone: "battlefield",
      quantity: 1,
    });
    collection = createDraftCollection([bf]);
    addCardAction(collection, { ...bf }, "battlefield", undefined, EMPTY_RUNES, "constructed");
    const cards = cardsOf(collection);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.quantity).toBe(1);
  });

  describe("legend options", () => {
    const neeko = () =>
      stubDeckBuilderCard({ cardId: "neeko", zone: "main", additionalLegendCount: 3 });
    const legend = (cardId: string) => stubDeckBuilderCard({ cardId, cardType: "legend" });
    const optionsOf = () => cardsOf(collection).filter((c) => c.zone === "legend-options");

    it("adds legends up to the number the deck grants", () => {
      collection = createDraftCollection([neeko()]);
      for (const cardId of ["a", "b", "c", "d"]) {
        addCardAction(collection, legend(cardId), "legend-options", 2, EMPTY_RUNES, "constructed");
      }
      expect(optionsOf().map((c) => [c.cardId, c.quantity])).toEqual([
        ["a", 1],
        ["b", 1],
        ["c", 1],
      ]);
    });

    it("adds nothing when no card grants extra legends", () => {
      addCardAction(collection, legend("a"), "legend-options", 1, EMPTY_RUNES, "constructed");
      expect(optionsOf()).toEqual([]);
    });

    it("does not add the same legend twice", () => {
      collection = createDraftCollection([neeko()]);
      addCardAction(collection, legend("a"), "legend-options", 1, EMPTY_RUNES, "constructed");
      addCardAction(collection, legend("a"), "legend-options", 1, EMPTY_RUNES, "constructed");
      expect(optionsOf()).toHaveLength(1);
    });

    it("rejects a non-legend", () => {
      collection = createDraftCollection([neeko()]);
      const unit = stubDeckBuilderCard({ cardId: "unit", cardType: "unit" });
      addCardAction(collection, unit, "legend-options", 1, EMPTY_RUNES, "constructed");
      expect(optionsOf()).toEqual([]);
    });
  });

  it("does not exceed 12 runes when no opposite-domain rune exists to swap", () => {
    const legend = stubDeckBuilderCard({
      cardId: "legend-1",
      cardType: "legend",
      zone: "legend",
      domains: ["fury", "calm"],
    });
    const furyRune = stubDeckBuilderCard({
      cardId: "fury-rune",
      cardType: "rune",
      zone: "runes",
      domains: ["fury"],
      quantity: 12,
    });
    collection = createDraftCollection([legend, furyRune]);
    const addCard = stubDeckBuilderCard({
      cardId: "fury-rune",
      cardType: "rune",
      domains: ["fury"],
    });
    addCardAction(collection, addCard, "runes", undefined, EMPTY_RUNES, "constructed");
    const total = cardsOf(collection)
      .filter((card) => card.zone === "runes")
      .reduce((sum, card) => sum + card.quantity, 0);
    expect(total).toBe(12);
  });

  it("allows a swap-add at 12 runes when an opposite-domain rune is in the deck", () => {
    const legend = stubDeckBuilderCard({
      cardId: "legend-1",
      cardType: "legend",
      zone: "legend",
      domains: ["fury", "calm"],
    });
    const furyRune = stubDeckBuilderCard({
      cardId: "fury-rune",
      cardType: "rune",
      zone: "runes",
      domains: ["fury"],
      quantity: 6,
    });
    const calmRune = stubDeckBuilderCard({
      cardId: "calm-rune",
      cardType: "rune",
      zone: "runes",
      domains: ["calm"],
      quantity: 6,
    });
    collection = createDraftCollection([legend, furyRune, calmRune]);
    const addCard = stubDeckBuilderCard({
      cardId: "fury-rune",
      cardType: "rune",
      domains: ["fury"],
    });
    addCardAction(collection, addCard, "runes", undefined, EMPTY_RUNES, "constructed");
    const runes = cardsOf(collection).filter((card) => card.zone === "runes");
    const total = runes.reduce((sum, card) => sum + card.quantity, 0);
    expect(total).toBe(12);
    expect(runes.find((card) => card.cardId === "fury-rune")?.quantity).toBe(7);
    expect(runes.find((card) => card.cardId === "calm-rune")?.quantity).toBe(5);
  });

  it("does not exceed 12 runes for a mono-domain legend", () => {
    const legend = stubDeckBuilderCard({
      cardId: "legend-1",
      cardType: "legend",
      zone: "legend",
      domains: ["fury"],
    });
    const furyRune = stubDeckBuilderCard({
      cardId: "fury-rune",
      cardType: "rune",
      zone: "runes",
      domains: ["fury"],
      quantity: 12,
    });
    collection = createDraftCollection([legend, furyRune]);
    const addCard = stubDeckBuilderCard({
      cardId: "fury-rune",
      cardType: "rune",
      domains: ["fury"],
    });
    addCardAction(collection, addCard, "runes", undefined, EMPTY_RUNES, "constructed");
    const total = cardsOf(collection)
      .filter((card) => card.zone === "runes")
      .reduce((sum, card) => sum + card.quantity, 0);
    expect(total).toBe(12);
  });
});

describe("canAddRune", () => {
  const dualLegend = () =>
    stubDeckBuilderCard({
      cardId: "legend-1",
      cardType: "legend",
      zone: "legend",
      domains: ["fury", "calm"],
    });

  it("allows adds below the cap", () => {
    const card = stubDeckBuilderCard({ cardType: "rune", domains: ["fury"] });
    const result = canAddRune(card, [
      dualLegend(),
      stubDeckBuilderCard({
        cardId: "fury-rune",
        cardType: "rune",
        zone: "runes",
        domains: ["fury"],
        quantity: 5,
      }),
    ]);
    expect(result).toBe(true);
  });

  it("blocks adds at the cap when no opposite-domain rune exists", () => {
    const card = stubDeckBuilderCard({ cardType: "rune", domains: ["fury"] });
    const result = canAddRune(card, [
      dualLegend(),
      stubDeckBuilderCard({
        cardId: "fury-rune",
        cardType: "rune",
        zone: "runes",
        domains: ["fury"],
        quantity: 12,
      }),
    ]);
    expect(result).toBe(false);
  });

  it("allows adds at the cap when an opposite-domain rune exists (swap)", () => {
    const card = stubDeckBuilderCard({ cardType: "rune", domains: ["fury"] });
    const result = canAddRune(card, [
      dualLegend(),
      stubDeckBuilderCard({
        cardId: "fury-rune",
        cardType: "rune",
        zone: "runes",
        domains: ["fury"],
        quantity: 6,
      }),
      stubDeckBuilderCard({
        cardId: "calm-rune",
        cardType: "rune",
        zone: "runes",
        domains: ["calm"],
        quantity: 6,
      }),
    ]);
    expect(result).toBe(true);
  });

  it("blocks adds at the cap when the legend is mono-domain", () => {
    const card = stubDeckBuilderCard({ cardType: "rune", domains: ["fury"] });
    const result = canAddRune(card, [
      stubDeckBuilderCard({
        cardId: "legend-mono",
        cardType: "legend",
        zone: "legend",
        domains: ["fury"],
      }),
      stubDeckBuilderCard({
        cardId: "fury-rune",
        cardType: "rune",
        zone: "runes",
        domains: ["fury"],
        quantity: 12,
      }),
    ]);
    expect(result).toBe(false);
  });
});

describe("removeCardAction", () => {
  it("decrements quantity when above 1", () => {
    const card = stubDeckBuilderCard({ cardId: "card-1", zone: "main", quantity: 3 });
    collection = createDraftCollection([card]);
    removeCardAction(collection, "card-1", "main", EMPTY_RUNES, "constructed");
    expect(cardsOf(collection)[0]!.quantity).toBe(2);
  });

  it("removes the entry entirely when quantity is 1", () => {
    const card = stubDeckBuilderCard({ cardId: "card-1", zone: "main", quantity: 1 });
    collection = createDraftCollection([card]);
    removeCardAction(collection, "card-1", "main", EMPTY_RUNES, "constructed");
    expect(cardsOf(collection)).toHaveLength(0);
  });

  it("does nothing when the card is not found", () => {
    removeCardAction(collection, "missing", "main", EMPTY_RUNES, "constructed");
    expect(cardsOf(collection)).toHaveLength(0);
  });

  it("rebalance pulls an opposite-domain rune from the catalog when none in deck", () => {
    const legend = stubDeckBuilderCard({
      cardId: "legend-1",
      cardType: "legend",
      zone: "legend",
      domains: ["fury", "calm"],
    });
    const furyRune = stubDeckBuilderCard({
      cardId: "fury-rune",
      cardType: "rune",
      zone: "runes",
      domains: ["fury"],
      quantity: 12,
    });
    const calmRune = stubDeckBuilderCard({
      cardId: "calm-rune",
      cardType: "rune",
      domains: ["calm"],
    });
    const runesByDomain = new Map<string, DeckBuilderCard[]>([
      ["fury", [stubDeckBuilderCard({ cardId: "fury-rune", cardType: "rune", domains: ["fury"] })]],
      ["calm", [calmRune]],
    ]);
    collection = createDraftCollection([legend, furyRune]);
    removeCardAction(collection, "fury-rune", "runes", runesByDomain, "constructed");
    const runes = cardsOf(collection).filter((card) => card.zone === "runes");
    const total = runes.reduce((sum, card) => sum + card.quantity, 0);
    expect(total).toBe(12);
    expect(runes.find((card) => card.cardId === "fury-rune")?.quantity).toBe(11);
    expect(runes.find((card) => card.cardId === "calm-rune")?.quantity).toBe(1);
  });

  it("rebalance is a no-op when runesByDomain catalog is empty (pre-hydration)", () => {
    const legend = stubDeckBuilderCard({
      cardId: "legend-1",
      cardType: "legend",
      zone: "legend",
      domains: ["fury", "calm"],
    });
    const furyRune = stubDeckBuilderCard({
      cardId: "fury-rune",
      cardType: "rune",
      zone: "runes",
      domains: ["fury"],
      quantity: 12,
    });
    collection = createDraftCollection([legend, furyRune]);
    removeCardAction(collection, "fury-rune", "runes", EMPTY_RUNES, "constructed");
    const runes = cardsOf(collection).filter((card) => card.zone === "runes");
    const total = runes.reduce((sum, card) => sum + card.quantity, 0);
    expect(total).toBe(11);
  });
});

describe("moveCardAction", () => {
  it("moves all copies from one zone to another", () => {
    const card = stubDeckBuilderCard({
      cardId: "card-1",
      cardType: "unit",
      zone: "main",
      quantity: 2,
    });
    collection = createDraftCollection([card]);
    moveCardAction(collection, "card-1", "main", "sideboard", null, "constructed");
    const cards = cardsOf(collection);
    expect(cards.filter((c) => c.zone === "main")).toHaveLength(0);
    expect(cards.find((c) => c.zone === "sideboard")?.quantity).toBe(2);
  });

  it("merges quantity when the card already exists in the target zone", () => {
    const mainCard = stubDeckBuilderCard({
      cardId: "card-1",
      cardType: "unit",
      zone: "main",
      quantity: 1,
    });
    const sideCard = stubDeckBuilderCard({
      cardId: "card-1",
      cardType: "unit",
      zone: "sideboard",
      quantity: 1,
    });
    collection = createDraftCollection([mainCard, sideCard]);
    moveCardAction(collection, "card-1", "main", "sideboard", null, "constructed");
    const cards = cardsOf(collection);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.zone).toBe("sideboard");
    expect(cards[0]!.quantity).toBe(2);
  });

  it("rejects moves to zones where the card type isn't allowed", () => {
    const unit = stubDeckBuilderCard({
      cardId: "card-1",
      cardType: "unit",
      zone: "main",
      quantity: 1,
    });
    collection = createDraftCollection([unit]);
    moveCardAction(collection, "card-1", "main", "legend", null, "constructed");
    expect(cardsOf(collection)[0]!.zone).toBe("main");
  });

  it("moves a champion from main into an empty champion slot, leaving extra copies behind", () => {
    const champ = stubDeckBuilderCard({
      cardId: "champ-a",
      cardType: "unit",
      superTypes: ["champion"],
      zone: "main",
      quantity: 2,
    });
    collection = createDraftCollection([champ]);
    moveCardAction(collection, "champ-a", "main", "champion", null, "constructed");
    const cards = cardsOf(collection);
    expect(cards.find((c) => c.zone === "champion")).toMatchObject({
      cardId: "champ-a",
      quantity: 1,
    });
    expect(cards.find((c) => c.zone === "main")).toMatchObject({ quantity: 1 });
  });

  it("replaces an existing champion when a different champion is dragged into the slot", () => {
    const oldChamp = stubDeckBuilderCard({
      cardId: "champ-a",
      cardType: "unit",
      superTypes: ["champion"],
      zone: "champion",
      quantity: 1,
    });
    const newChamp = stubDeckBuilderCard({
      cardId: "champ-b",
      cardType: "unit",
      superTypes: ["champion"],
      zone: "main",
      quantity: 1,
    });
    collection = createDraftCollection([oldChamp, newChamp]);
    moveCardAction(collection, "champ-b", "main", "champion", null, "constructed");
    const cards = cardsOf(collection);
    expect(cards.filter((c) => c.zone === "champion")).toHaveLength(1);
    expect(cards.find((c) => c.zone === "champion")?.cardId).toBe("champ-b");
    expect(cards.some((c) => c.cardId === "champ-a")).toBe(false);
  });

  it("is a no-op when the same champion+printing already fills the slot, so no copy is lost", () => {
    const inSlot = stubDeckBuilderCard({
      cardId: "champ-a",
      cardType: "unit",
      superTypes: ["champion"],
      zone: "champion",
      quantity: 1,
    });
    const inMain = stubDeckBuilderCard({
      cardId: "champ-a",
      cardType: "unit",
      superTypes: ["champion"],
      zone: "main",
      quantity: 2,
    });
    collection = createDraftCollection([inSlot, inMain]);
    moveCardAction(collection, "champ-a", "main", "champion", null, "constructed");
    const cards = cardsOf(collection);
    expect(cards.find((c) => c.zone === "main")?.quantity).toBe(2);
    expect(cards.find((c) => c.zone === "champion")?.quantity).toBe(1);
  });
});

describe("moveOneCardAction", () => {
  it("moves exactly one copy from source to target", () => {
    const card = stubDeckBuilderCard({
      cardId: "card-1",
      cardType: "unit",
      zone: "main",
      quantity: 3,
    });
    collection = createDraftCollection([card]);
    moveOneCardAction(collection, "card-1", "main", "sideboard", null, "constructed");
    const cards = cardsOf(collection);
    expect(cards.find((c) => c.zone === "main")?.quantity).toBe(2);
    expect(cards.find((c) => c.zone === "sideboard")?.quantity).toBe(1);
  });

  it("removes the source entry when the last copy moves", () => {
    const card = stubDeckBuilderCard({
      cardId: "card-1",
      cardType: "unit",
      zone: "main",
      quantity: 1,
    });
    collection = createDraftCollection([card]);
    moveOneCardAction(collection, "card-1", "main", "sideboard", null, "constructed");
    const cards = cardsOf(collection);
    expect(cards.filter((c) => c.zone === "main")).toHaveLength(0);
    expect(cards.find((c) => c.zone === "sideboard")?.quantity).toBe(1);
  });

  it("replaces the champion slot when dragging a single copy of a different champion in", () => {
    const oldChamp = stubDeckBuilderCard({
      cardId: "champ-a",
      cardType: "unit",
      superTypes: ["champion"],
      zone: "champion",
      quantity: 1,
    });
    const newChamp = stubDeckBuilderCard({
      cardId: "champ-b",
      cardType: "unit",
      superTypes: ["champion"],
      zone: "main",
      quantity: 3,
    });
    collection = createDraftCollection([oldChamp, newChamp]);
    moveOneCardAction(collection, "champ-b", "main", "champion", null, "constructed");
    const cards = cardsOf(collection);
    expect(cards.find((c) => c.zone === "champion")?.cardId).toBe("champ-b");
    expect(cards.find((c) => c.zone === "main")?.quantity).toBe(2);
    expect(cards.some((c) => c.cardId === "champ-a")).toBe(false);
  });
});

describe("setQuantityAction", () => {
  it("sets the quantity of an existing card", () => {
    const card = stubDeckBuilderCard({ cardId: "card-1", zone: "main", quantity: 1 });
    collection = createDraftCollection([card]);
    setQuantityAction(collection, "card-1", "main", 3);
    expect(cardsOf(collection)[0]!.quantity).toBe(3);
  });

  it("removes the card when quantity is set to 0", () => {
    const card = stubDeckBuilderCard({ cardId: "card-1", zone: "main", quantity: 2 });
    collection = createDraftCollection([card]);
    setQuantityAction(collection, "card-1", "main", 0);
    expect(cardsOf(collection)).toHaveLength(0);
  });

  it("removes the card when quantity is negative", () => {
    const card = stubDeckBuilderCard({ cardId: "card-1", zone: "main", quantity: 2 });
    collection = createDraftCollection([card]);
    setQuantityAction(collection, "card-1", "main", -1);
    expect(cardsOf(collection)).toHaveLength(0);
  });
});

describe("setLegendAction", () => {
  it("replaces an existing legend", () => {
    const oldLegend = stubDeckBuilderCard({
      cardId: "old",
      cardType: "legend",
      zone: "legend",
      domains: ["fury", "calm"],
    });
    collection = createDraftCollection([oldLegend]);
    const newLegend = stubDeckBuilderCard({
      cardId: "new",
      cardType: "legend",
      domains: ["mind", "body"],
    });
    setLegendAction(collection, newLegend, EMPTY_RUNES, "constructed");
    const legends = cardsOf(collection).filter((c) => c.zone === "legend");
    expect(legends).toHaveLength(1);
    expect(legends[0]!.cardId).toBe("new");
  });

  it("clears incompatible runes when legend domains change", () => {
    const legend = stubDeckBuilderCard({
      cardId: "legend-1",
      cardType: "legend",
      zone: "legend",
      domains: ["fury", "calm"],
    });
    const rune = stubDeckBuilderCard({
      cardId: "rune-1",
      cardType: "rune",
      zone: "runes",
      domains: ["fury"],
      quantity: 6,
    });
    collection = createDraftCollection([legend, rune]);
    const newLegend = stubDeckBuilderCard({
      cardId: "legend-2",
      cardType: "legend",
      domains: ["mind", "body"],
    });
    setLegendAction(collection, newLegend, EMPTY_RUNES, "constructed");
    const runes = cardsOf(collection).filter((c) => c.zone === "runes");
    expect(runes.every((r) => r.domains.every((d) => ["mind", "body"].includes(d)))).toBe(true);
  });

  it("keeps compatible runes and drops only incompatible ones on a partial-overlap switch", () => {
    const legend = stubDeckBuilderCard({
      cardId: "legend-1",
      cardType: "legend",
      zone: "legend",
      domains: ["fury", "calm"],
    });
    const compatibleRune = stubDeckBuilderCard({
      cardId: "rune-compatible",
      cardType: "rune",
      zone: "runes",
      domains: ["calm"],
      quantity: 6,
      preferredPrintingId: "printing-compatible",
    });
    const incompatibleRune = stubDeckBuilderCard({
      cardId: "rune-incompatible",
      cardType: "rune",
      zone: "runes",
      domains: ["fury"],
      quantity: 6,
    });
    collection = createDraftCollection([legend, compatibleRune, incompatibleRune]);
    const newLegend = stubDeckBuilderCard({
      cardId: "legend-2",
      cardType: "legend",
      domains: ["calm", "mind"],
    });
    setLegendAction(collection, newLegend, EMPTY_RUNES, "constructed");
    const runes = cardsOf(collection).filter((c) => c.zone === "runes");
    expect(runes.map((r) => r.cardId)).toEqual(["rune-compatible"]);
    expect(runes[0]!.preferredPrintingId).toBe("printing-compatible");
  });

  it("deletes no runes when the new legend's domains cover every existing rune", () => {
    const legend = stubDeckBuilderCard({
      cardId: "legend-1",
      cardType: "legend",
      zone: "legend",
      domains: ["fury", "calm"],
    });
    const rune = stubDeckBuilderCard({
      cardId: "rune-1",
      cardType: "rune",
      zone: "runes",
      domains: ["fury"],
      quantity: 6,
      preferredPrintingId: "printing-1",
    });
    collection = createDraftCollection([legend, rune]);
    const newLegend = stubDeckBuilderCard({
      cardId: "legend-2",
      cardType: "legend",
      domains: ["fury", "mind"],
    });
    setLegendAction(collection, newLegend, EMPTY_RUNES, "constructed");
    const runes = cardsOf(collection).filter((c) => c.zone === "runes");
    expect(runes.map((r) => r.cardId)).toEqual(["rune-1"]);
    expect(runes[0]!.preferredPrintingId).toBe("printing-1");
  });

  it("auto-populates runes when runesByDomain is provided", () => {
    const furyRune = stubDeckBuilderCard({
      cardId: "fury-rune",
      cardType: "rune",
      domains: ["fury"],
    });
    const calmRune = stubDeckBuilderCard({
      cardId: "calm-rune",
      cardType: "rune",
      domains: ["calm"],
    });
    const runesByDomain = new Map<string, DeckBuilderCard[]>([
      ["fury", [furyRune]],
      ["calm", [calmRune]],
    ]);
    const legend = stubDeckBuilderCard({
      cardId: "legend-1",
      cardType: "legend",
      domains: ["fury", "calm"],
    });
    setLegendAction(collection, legend, runesByDomain, "constructed");
    const runes = cardsOf(collection).filter((c) => c.zone === "runes");
    const totalQty = runes.reduce((sum, r) => sum + r.quantity, 0);
    expect(totalQty).toBe(12);
  });
});

describe("freeform format", () => {
  it("allows multiple distinct legends instead of replacing", () => {
    const first = stubDeckBuilderCard({ cardId: "legend-a", cardType: "legend" });
    const second = stubDeckBuilderCard({ cardId: "legend-b", cardType: "legend" });
    addCardAction(collection, first, "legend", undefined, EMPTY_RUNES, "freeform");
    addCardAction(collection, second, "legend", undefined, EMPTY_RUNES, "freeform");
    const legends = cardsOf(collection).filter((card) => card.zone === "legend");
    expect(legends).toHaveLength(2);
    expect(legends.map((card) => card.cardId).sort()).toEqual(["legend-a", "legend-b"]);
  });

  it("allows multiple distinct champions instead of replacing", () => {
    const first = stubDeckBuilderCard({
      cardId: "champ-a",
      cardType: "unit",
      superTypes: ["champion"],
    });
    const second = stubDeckBuilderCard({
      cardId: "champ-b",
      cardType: "unit",
      superTypes: ["champion"],
    });
    addCardAction(collection, first, "champion", undefined, EMPTY_RUNES, "freeform");
    addCardAction(collection, second, "champion", undefined, EMPTY_RUNES, "freeform");
    expect(cardsOf(collection).filter((card) => card.zone === "champion")).toHaveLength(2);
  });

  it("allows more than 3 battlefields and duplicate quantities", () => {
    const bf = stubDeckBuilderCard({ cardId: "bf-1", cardType: "battlefield" });
    for (let step = 0; step < 5; step++) {
      addCardAction(collection, bf, "battlefield", undefined, EMPTY_RUNES, "freeform");
    }
    const row = cardsOf(collection).find((card) => card.zone === "battlefield");
    expect(row?.quantity).toBe(5);
  });

  it("allows 4+ copies of the same card in main", () => {
    const card = stubDeckBuilderCard({ cardId: "card-1", cardType: "unit" });
    addCardAction(collection, card, "main", 5, EMPTY_RUNES, "freeform");
    expect(cardsOf(collection)[0]!.quantity).toBe(5);
  });

  it("ignores the 12-rune cap and does not rebalance", () => {
    const legend = stubDeckBuilderCard({
      cardId: "legend-1",
      cardType: "legend",
      zone: "legend",
      domains: ["fury", "calm"],
    });
    const furyRune = stubDeckBuilderCard({
      cardId: "fury-rune",
      cardType: "rune",
      zone: "runes",
      domains: ["fury"],
      quantity: 12,
    });
    collection = createDraftCollection([legend, furyRune]);
    const addCard = stubDeckBuilderCard({
      cardId: "fury-rune",
      cardType: "rune",
      domains: ["fury"],
    });
    addCardAction(collection, addCard, "runes", 3, EMPTY_RUNES, "freeform");
    const runes = cardsOf(collection).filter((card) => card.zone === "runes");
    expect(runes.find((card) => card.cardId === "fury-rune")?.quantity).toBe(15);
  });

  it("removeCardAction does not rebalance runes in freeform", () => {
    const legend = stubDeckBuilderCard({
      cardId: "legend-1",
      cardType: "legend",
      zone: "legend",
      domains: ["fury", "calm"],
    });
    const furyRune = stubDeckBuilderCard({
      cardId: "fury-rune",
      cardType: "rune",
      zone: "runes",
      domains: ["fury"],
      quantity: 5,
    });
    const calmCatalogRune = stubDeckBuilderCard({
      cardId: "calm-rune",
      cardType: "rune",
      domains: ["calm"],
    });
    const runesByDomain = new Map<string, DeckBuilderCard[]>([["calm", [calmCatalogRune]]]);
    collection = createDraftCollection([legend, furyRune]);
    removeCardAction(collection, "fury-rune", "runes", runesByDomain, "freeform");
    const runes = cardsOf(collection).filter((card) => card.zone === "runes");
    expect(runes).toHaveLength(1);
    expect(runes[0]!.cardId).toBe("fury-rune");
    expect(runes[0]!.quantity).toBe(4);
  });

  it("setLegendAction adds a legend without dropping runes or autofilling", () => {
    const incompatibleRune = stubDeckBuilderCard({
      cardId: "fury-rune",
      cardType: "rune",
      zone: "runes",
      domains: ["fury"],
      quantity: 3,
    });
    const calmCatalogRune = stubDeckBuilderCard({
      cardId: "calm-rune",
      cardType: "rune",
      domains: ["calm"],
    });
    const mindCatalogRune = stubDeckBuilderCard({
      cardId: "mind-rune",
      cardType: "rune",
      domains: ["mind"],
    });
    const runesByDomain = new Map<string, DeckBuilderCard[]>([
      ["calm", [calmCatalogRune]],
      ["mind", [mindCatalogRune]],
    ]);
    collection = createDraftCollection([incompatibleRune]);
    const legend = stubDeckBuilderCard({
      cardId: "legend-1",
      cardType: "legend",
      domains: ["calm", "mind"],
    });
    setLegendAction(collection, legend, runesByDomain, "freeform");
    const runes = cardsOf(collection).filter((card) => card.zone === "runes");
    expect(runes).toHaveLength(1);
    expect(runes[0]!.cardId).toBe("fury-rune");
    expect(runes[0]!.quantity).toBe(3);
    expect(cardsOf(collection).filter((card) => card.zone === "legend")).toHaveLength(1);
  });

  it("moveCardAction treats legend/champion as multi-card zones", () => {
    const existingChamp = stubDeckBuilderCard({
      cardId: "champ-a",
      cardType: "unit",
      superTypes: ["champion"],
      zone: "champion",
      quantity: 1,
    });
    const incoming = stubDeckBuilderCard({
      cardId: "champ-b",
      cardType: "unit",
      superTypes: ["champion"],
      zone: "main",
      quantity: 1,
    });
    collection = createDraftCollection([existingChamp, incoming]);
    moveCardAction(collection, "champ-b", "main", "champion", null, "freeform");
    const champs = cardsOf(collection).filter((card) => card.zone === "champion");
    expect(champs).toHaveLength(2);
  });
});

describe("preferred printings", () => {
  it("keeps separate rows when the same card is added with distinct printings", () => {
    const base = stubDeckBuilderCard({
      cardId: "c1",
      cardType: "unit",
      preferredPrintingId: null,
    });
    const alt = stubDeckBuilderCard({
      cardId: "c1",
      cardType: "unit",
      preferredPrintingId: "printing-alt",
    });
    addCardAction(collection, base, "main", 2, EMPTY_RUNES, "constructed");
    addCardAction(collection, alt, "main", 1, EMPTY_RUNES, "constructed");
    const cards = cardsOf(collection).filter((c) => c.zone === "main");
    expect(cards).toHaveLength(2);
    const totalsByPrinting = Map.groupBy(cards, (c) => c.preferredPrintingId ?? "default");
    expect(totalsByPrinting.get("default")?.[0]?.quantity).toBe(2);
    expect(totalsByPrinting.get("printing-alt")?.[0]?.quantity).toBe(1);
  });

  it("enforces the 3-copy cap across distinct printings of the same card", () => {
    const base = stubDeckBuilderCard({
      cardId: "c1",
      cardType: "unit",
      preferredPrintingId: null,
    });
    const alt = stubDeckBuilderCard({
      cardId: "c1",
      cardType: "unit",
      preferredPrintingId: "printing-alt",
    });
    addCardAction(collection, base, "main", 2, EMPTY_RUNES, "constructed");
    addCardAction(collection, alt, "main", 2, EMPTY_RUNES, "constructed");
    const total = cardsOf(collection)
      .filter((c) => c.cardId === "c1" && c.zone === "main")
      .reduce((sum, c) => sum + c.quantity, 0);
    expect(total).toBe(3);
  });

  it("removeCard targets the default-art row when no printing is passed", () => {
    const base = stubDeckBuilderCard({
      cardId: "c1",
      cardType: "unit",
      zone: "main",
      preferredPrintingId: null,
      quantity: 2,
    });
    const alt = stubDeckBuilderCard({
      cardId: "c1",
      cardType: "unit",
      zone: "main",
      preferredPrintingId: "printing-alt",
      quantity: 1,
    });
    collection = createDraftCollection([base, alt]);
    removeCardAction(collection, "c1", "main", EMPTY_RUNES, "constructed");
    const cards = cardsOf(collection);
    const baseRow = cards.find((c) => c.preferredPrintingId === null);
    const altRow = cards.find((c) => c.preferredPrintingId === "printing-alt");
    expect(baseRow?.quantity).toBe(1);
    expect(altRow?.quantity).toBe(1);
  });

  it("removeCard targets a specific row when preferredPrintingId is passed", () => {
    const alt = stubDeckBuilderCard({
      cardId: "c1",
      cardType: "unit",
      zone: "main",
      preferredPrintingId: "printing-alt",
      quantity: 2,
    });
    collection = createDraftCollection([alt]);
    removeCardAction(collection, "c1", "main", EMPTY_RUNES, "constructed", "printing-alt");
    expect(cardsOf(collection)[0]!.quantity).toBe(1);
  });

  describe("changePreferredPrintingAction", () => {
    it("repoints the whole row when count equals the row's quantity", () => {
      const row = stubDeckBuilderCard({
        cardId: "c1",
        cardType: "unit",
        zone: "main",
        preferredPrintingId: null,
        quantity: 3,
      });
      collection = createDraftCollection([row]);
      changePreferredPrintingAction(collection, "c1", "main", null, "printing-alt", 3);
      const cards = cardsOf(collection);
      expect(cards).toHaveLength(1);
      expect(cards[0]!.preferredPrintingId).toBe("printing-alt");
      expect(cards[0]!.quantity).toBe(3);
    });

    it("splits into two rows when count is less than the source quantity", () => {
      const row = stubDeckBuilderCard({
        cardId: "c1",
        cardType: "unit",
        zone: "main",
        preferredPrintingId: null,
        quantity: 3,
      });
      collection = createDraftCollection([row]);
      changePreferredPrintingAction(collection, "c1", "main", null, "printing-alt", 2);
      const cards = cardsOf(collection);
      expect(cards).toHaveLength(2);
      const base = cards.find((c) => c.preferredPrintingId === null);
      const alt = cards.find((c) => c.preferredPrintingId === "printing-alt");
      expect(base?.quantity).toBe(1);
      expect(alt?.quantity).toBe(2);
    });

    it("merges into an existing target row at the same (card, zone)", () => {
      const base = stubDeckBuilderCard({
        cardId: "c1",
        cardType: "unit",
        zone: "main",
        preferredPrintingId: null,
        quantity: 2,
      });
      const alt = stubDeckBuilderCard({
        cardId: "c1",
        cardType: "unit",
        zone: "main",
        preferredPrintingId: "printing-alt",
        quantity: 1,
      });
      collection = createDraftCollection([base, alt]);
      changePreferredPrintingAction(collection, "c1", "main", null, "printing-alt", 2);
      const cards = cardsOf(collection);
      expect(cards).toHaveLength(1);
      expect(cards[0]!.preferredPrintingId).toBe("printing-alt");
      expect(cards[0]!.quantity).toBe(3);
    });

    it("no-ops when from and to printings match", () => {
      const row = stubDeckBuilderCard({
        cardId: "c1",
        cardType: "unit",
        zone: "main",
        preferredPrintingId: "printing-alt",
        quantity: 2,
      });
      collection = createDraftCollection([row]);
      changePreferredPrintingAction(collection, "c1", "main", "printing-alt", "printing-alt", 2);
      expect(cardsOf(collection)[0]!.quantity).toBe(2);
    });
  });
});

describe("relaxed addCardAction", () => {
  const relaxed = { relaxed: true };
  const totalOf = (zone: string) =>
    cardsOf(collection)
      .filter((entry) => entry.zone === zone)
      .reduce((sum, entry) => sum + entry.quantity, 0);

  describe("copy limit", () => {
    const unit = () =>
      stubDeckBuilderCard({ cardId: "card-1", cardType: "unit", zone: "main", quantity: 3 });

    it("lets the 4th copy in and reports the broken limit", () => {
      const card = unit();
      collection = createDraftCollection([card]);
      const outcome = addCardAction(
        collection,
        card,
        "main",
        undefined,
        EMPTY_RUNES,
        "constructed",
        relaxed,
      );
      expect(totalOf("main")).toBe(4);
      expect(outcome).toMatchObject({
        rule: "copyLimit",
        zone: "main",
        quantity: 1,
        total: 4,
        limit: 3,
      });
      expect(outcome?.card.cardId).toBe("card-1");
    });

    it("lets a second Unique copy in and reports the broken limit", () => {
      const card = stubDeckBuilderCard({
        cardId: "card-1",
        cardType: "unit",
        zone: "main",
        quantity: 1,
        keywords: ["Unique"],
      });
      collection = createDraftCollection([card]);
      const outcome = addCardAction(
        collection,
        card,
        "sideboard",
        undefined,
        EMPTY_RUNES,
        "constructed",
        relaxed,
      );
      expect(totalOf("sideboard")).toBe(1);
      expect(outcome).toMatchObject({ rule: "copyLimit", total: 2, limit: 1 });
    });

    it("blocks the 4th copy without the relaxed option", () => {
      const card = unit();
      collection = createDraftCollection([card]);
      const outcome = addCardAction(
        collection,
        card,
        "main",
        undefined,
        EMPTY_RUNES,
        "constructed",
      );
      expect(outcome).toBeUndefined();
      expect(totalOf("main")).toBe(3);
    });

    it("blocks the 4th copy when relaxed is false", () => {
      const card = unit();
      collection = createDraftCollection([card]);
      const outcome = addCardAction(
        collection,
        card,
        "main",
        undefined,
        EMPTY_RUNES,
        "constructed",
        { relaxed: false },
      );
      expect(outcome).toBeUndefined();
      expect(totalOf("main")).toBe(3);
    });

    it("counts copies across main and sideboard", () => {
      const card = unit();
      collection = createDraftCollection([
        { ...card, quantity: 2 },
        { ...card, zone: "sideboard", quantity: 1 },
      ]);
      const outcome = addCardAction(
        collection,
        card,
        "main",
        undefined,
        EMPTY_RUNES,
        "constructed",
        relaxed,
      );
      expect(outcome).toMatchObject({ rule: "copyLimit", total: 4, limit: 3 });
    });

    it("reports nothing when the add stays under the limit", () => {
      const card = stubDeckBuilderCard({ cardId: "card-1", cardType: "unit" });
      const outcome = addCardAction(
        collection,
        card,
        "main",
        undefined,
        EMPTY_RUNES,
        "constructed",
        relaxed,
      );
      expect(outcome).toBeUndefined();
      expect(totalOf("main")).toBe(1);
    });

    it("still clamps an explicit count below the limit when relaxed", () => {
      const card = stubDeckBuilderCard({ ...unit(), quantity: 1 });
      collection = createDraftCollection([card]);
      const outcome = addCardAction(
        collection,
        card,
        "main",
        3,
        EMPTY_RUNES,
        "constructed",
        relaxed,
      );
      expect(outcome).toBeUndefined();
      expect(totalOf("main")).toBe(3);
    });

    it("adds one copy with a warning for an explicit count at the limit", () => {
      const card = unit();
      collection = createDraftCollection([card]);
      const outcome = addCardAction(
        collection,
        card,
        "main",
        3,
        EMPTY_RUNES,
        "constructed",
        relaxed,
      );
      expect(outcome).toMatchObject({ rule: "copyLimit", quantity: 1, total: 4, limit: 3 });
      expect(totalOf("main")).toBe(4);
    });
  });

  describe("battlefield", () => {
    const battlefield = (cardId: string) =>
      stubDeckBuilderCard({ cardId, cardType: "battlefield", zone: "battlefield" });
    const three = () => ["bf-0", "bf-1", "bf-2"].map((id) => battlefield(id));

    it("adds a 4th battlefield and reports the cap", () => {
      collection = createDraftCollection(three());
      const outcome = addCardAction(
        collection,
        battlefield("bf-new"),
        "battlefield",
        undefined,
        EMPTY_RUNES,
        "constructed",
        relaxed,
      );
      expect(cardsOf(collection).filter((c) => c.zone === "battlefield")).toHaveLength(4);
      expect(outcome).toMatchObject({ rule: "battlefieldCap", total: 4, limit: 3, quantity: 1 });
    });

    it("blocks a 4th battlefield without relaxed", () => {
      collection = createDraftCollection(three());
      const outcome = addCardAction(
        collection,
        battlefield("bf-new"),
        "battlefield",
        undefined,
        EMPTY_RUNES,
        "constructed",
      );
      expect(outcome).toBeUndefined();
      expect(cardsOf(collection)).toHaveLength(3);
    });

    it("adds a duplicate battlefield and reports it", () => {
      collection = createDraftCollection([battlefield("bf-0")]);
      const outcome = addCardAction(
        collection,
        battlefield("bf-0"),
        "battlefield",
        undefined,
        EMPTY_RUNES,
        "constructed",
        relaxed,
      );
      expect(cardsOf(collection)).toHaveLength(1);
      expect(cardsOf(collection)[0]!.quantity).toBe(2);
      expect(outcome).toMatchObject({ rule: "battlefieldDuplicate", total: 1, limit: 3 });
    });

    it("reports a duplicate before the cap when both apply", () => {
      collection = createDraftCollection(three());
      const outcome = addCardAction(
        collection,
        battlefield("bf-1"),
        "battlefield",
        undefined,
        EMPTY_RUNES,
        "constructed",
        relaxed,
      );
      expect(outcome?.rule).toBe("battlefieldDuplicate");
    });

    it("uses a limit of 1 in custom-region", () => {
      collection = createDraftCollection([battlefield("bf-0")]);
      const outcome = addCardAction(
        collection,
        battlefield("bf-new"),
        "battlefield",
        undefined,
        EMPTY_RUNES,
        "custom-region",
        relaxed,
      );
      expect(outcome).toMatchObject({ rule: "battlefieldCap", total: 2, limit: 1 });
    });

    it("reports nothing for a legal battlefield add", () => {
      const outcome = addCardAction(
        collection,
        battlefield("bf-0"),
        "battlefield",
        undefined,
        EMPTY_RUNES,
        "constructed",
        relaxed,
      );
      expect(outcome).toBeUndefined();
      expect(cardsOf(collection)).toHaveLength(1);
    });
  });

  describe("runes", () => {
    const legend = (domains: string[]) =>
      stubDeckBuilderCard({
        cardId: "legend-1",
        cardType: "legend",
        zone: "legend",
        domains: domains as Domain[],
      });
    const rune = (cardId: string, domain: string, quantity: number) =>
      stubDeckBuilderCard({
        cardId,
        cardType: "rune",
        zone: "runes",
        domains: [domain as Domain],
        quantity,
      });

    it("swaps out an opposite-domain rune past 12 and reports it", () => {
      collection = createDraftCollection([
        legend(["fury", "calm"]),
        rune("fury-rune", "fury", 6),
        rune("calm-rune", "calm", 6),
      ]);
      const outcome = addCardAction(
        collection,
        rune("fury-rune", "fury", 1),
        "runes",
        undefined,
        EMPTY_RUNES,
        "constructed",
        relaxed,
      );
      expect(outcome).toMatchObject({ rule: "runeSwap", total: 12, limit: 12, quantity: 1 });
      expect(outcome?.swappedOut?.cardId).toBe("calm-rune");
      expect(totalOf("runes")).toBe(12);
      const calm = cardsOf(collection).find((c) => c.cardId === "calm-rune");
      expect(calm?.quantity).toBe(5);
    });

    it("reports no outcome for a swap without the relaxed option", () => {
      collection = createDraftCollection([
        legend(["fury", "calm"]),
        rune("fury-rune", "fury", 6),
        rune("calm-rune", "calm", 6),
      ]);
      const outcome = addCardAction(
        collection,
        rune("fury-rune", "fury", 1),
        "runes",
        undefined,
        EMPTY_RUNES,
        "constructed",
      );
      expect(outcome).toBeUndefined();
      expect(totalOf("runes")).toBe(12);
    });

    it("reports nothing when the rune fits under 12", () => {
      collection = createDraftCollection([legend(["fury", "calm"])]);
      const outcome = addCardAction(
        collection,
        rune("fury-rune", "fury", 1),
        "runes",
        undefined,
        EMPTY_RUNES,
        "constructed",
        relaxed,
      );
      expect(outcome).toBeUndefined();
      expect(totalOf("runes")).toBe(1);
    });

    it("goes over 12 with a runeCap outcome when no swap is possible", () => {
      collection = createDraftCollection([legend(["fury"]), rune("fury-rune", "fury", 12)]);
      const outcome = addCardAction(
        collection,
        rune("fury-rune", "fury", 1),
        "runes",
        undefined,
        EMPTY_RUNES,
        "constructed",
        relaxed,
      );
      expect(outcome).toMatchObject({ rule: "runeCap", total: 13, limit: 12 });
      expect(totalOf("runes")).toBe(13);
    });
  });

  describe("legend options", () => {
    it("adds past the granted count and reports the cap", () => {
      const neeko = stubDeckBuilderCard({
        cardId: "neeko",
        zone: "main",
        additionalLegendCount: 1,
      });
      const legend = (cardId: string) => stubDeckBuilderCard({ cardId, cardType: "legend" });
      collection = createDraftCollection([neeko]);
      addCardAction(
        collection,
        legend("a"),
        "legend-options",
        1,
        EMPTY_RUNES,
        "constructed",
        relaxed,
      );
      const outcome = addCardAction(
        collection,
        legend("b"),
        "legend-options",
        1,
        EMPTY_RUNES,
        "constructed",
        relaxed,
      );
      expect(outcome).toMatchObject({ rule: "legendOptionsCap", total: 2, limit: 1 });
      expect(cardsOf(collection).filter((c) => c.zone === "legend-options")).toHaveLength(2);
    });
  });
});

describe("setLegendAction options", () => {
  const legendOf = (cardId: string, domains: string[]) =>
    stubDeckBuilderCard({
      cardId,
      cardType: "legend",
      zone: "legend",
      domains: domains as Domain[],
    });
  const rune = (cardId: string, domain: string, quantity: number) =>
    stubDeckBuilderCard({
      cardId,
      cardType: "rune",
      zone: "runes",
      domains: [domain as Domain],
      quantity,
    });
  const mainCard = (cardId: string, zone: "main" | "sideboard", domain: string, quantity = 1) =>
    stubDeckBuilderCard({ cardId, zone, domains: [domain as Domain], quantity });
  const runesOf = () => cardsOf(collection).filter((c) => c.zone === "runes");
  const runeCatalog = new Map([
    ["fury", [rune("cat-fury", "fury", 1)]],
    ["calm", [rune("cat-calm", "calm", 1)]],
    ["mind", [rune("cat-mind", "mind", 1)]],
  ]);

  it("tops kept runes back up to 6 per domain with refill", () => {
    collection = createDraftCollection([
      legendOf("old", ["fury", "calm"]),
      rune("fury-rune", "fury", 6),
      rune("calm-rune", "calm", 6),
    ]);
    setLegendAction(collection, legendOf("new", ["fury", "mind"]), runeCatalog, "constructed", {
      refill: true,
    });
    expect(new Map(runesOf().map((c) => [c.cardId, c.quantity]))).toEqual(
      new Map([
        ["fury-rune", 6],
        ["cat-mind", 6],
      ]),
    );
  });

  it("adds the missing copies when a kept domain is below 6", () => {
    collection = createDraftCollection([
      legendOf("old", ["fury", "calm"]),
      rune("fury-rune", "fury", 4),
      rune("calm-rune", "calm", 6),
    ]);
    setLegendAction(collection, legendOf("new", ["fury", "mind"]), runeCatalog, "constructed", {
      refill: true,
    });
    const byId = new Map(runesOf().map((c) => [c.cardId, c.quantity]));
    expect(byId.get("fury-rune")).toBe(4);
    expect(byId.get("cat-fury")).toBe(2);
    expect(byId.get("cat-mind")).toBe(6);
  });

  it("leaves kept runes short without refill", () => {
    collection = createDraftCollection([
      legendOf("old", ["fury", "calm"]),
      rune("fury-rune", "fury", 6),
      rune("calm-rune", "calm", 6),
    ]);
    setLegendAction(collection, legendOf("new", ["fury", "mind"]), runeCatalog, "constructed");
    expect(runesOf().map((c) => [c.cardId, c.quantity])).toEqual([["fury-rune", 6]]);
  });

  it("moves off-color Main and Sideboard cards to overflow", () => {
    collection = createDraftCollection([
      legendOf("old", ["fury", "calm"]),
      mainCard("off-main", "main", "mind", 2),
      mainCard("off-side", "sideboard", "mind"),
      mainCard("on", "main", "fury"),
      mainCard("neutral", "main", "neutral"),
    ]);
    setLegendAction(collection, legendOf("new", ["fury", "body"]), EMPTY_RUNES, "constructed", {
      moveOffColorToOverflow: true,
    });
    const zones = new Map(cardsOf(collection).map((c) => [c.cardId, c.zone]));
    expect(zones.get("off-main")).toBe("overflow");
    expect(zones.get("off-side")).toBe("overflow");
    expect(zones.get("on")).toBe("main");
    expect(zones.get("neutral")).toBe("main");
    expect(cardsOf(collection).find((c) => c.cardId === "off-main")?.quantity).toBe(2);
  });

  it("keeps off-color cards in place without the option", () => {
    collection = createDraftCollection([
      legendOf("old", ["fury", "calm"]),
      mainCard("off-main", "main", "mind"),
    ]);
    setLegendAction(collection, legendOf("new", ["fury", "body"]), EMPTY_RUNES, "constructed");
    expect(cardsOf(collection).find((c) => c.cardId === "off-main")?.zone).toBe("main");
  });
});

describe("undoRelaxedAddAction", () => {
  const rune = (cardId: string, domain: string, quantity: number, printing: string | null = null) =>
    stubDeckBuilderCard({
      cardId,
      cardType: "rune",
      zone: "runes",
      domains: [domain as Domain],
      quantity,
      preferredPrintingId: printing,
    });
  const runeCount = (cardId: string) =>
    cardsOf(collection)
      .filter((card) => card.cardId === cardId)
      .reduce((sum, card) => sum + card.quantity, 0);

  it("gives a rune swap its swapped-out rune back with its printing", () => {
    collection = createDraftCollection([
      stubDeckBuilderCard({
        cardId: "legend-1",
        cardType: "legend",
        zone: "legend",
        domains: ["fury", "calm"] as Domain[],
      }),
      rune("fury-rune", "fury", 6),
      rune("calm-rune", "calm", 1, "calm-foil"),
      rune("calm-rune", "calm", 5),
    ]);
    const outcome = addCardAction(
      collection,
      rune("fury-rune", "fury", 1),
      "runes",
      undefined,
      EMPTY_RUNES,
      "constructed",
      { relaxed: true },
    );
    expect(outcome?.rule).toBe("runeSwap");
    if (!outcome) {
      return;
    }
    const swappedPrinting = outcome.swappedOut?.preferredPrintingId;
    undoRelaxedAddAction(collection, outcome, EMPTY_RUNES, "constructed");
    expect(runeCount("fury-rune")).toBe(6);
    expect(runeCount("calm-rune")).toBe(6);
    const restored = cardsOf(collection).find(
      (card) => card.cardId === "calm-rune" && card.preferredPrintingId === swappedPrinting,
    );
    expect(restored).toBeDefined();
  });

  it("removes one copy for an over-limit add", () => {
    const card = stubDeckBuilderCard({ cardId: "scorcher", zone: "main", quantity: 3 });
    collection = createDraftCollection([card]);
    const outcome = addCardAction(
      collection,
      { ...card, quantity: 1 },
      "main",
      undefined,
      EMPTY_RUNES,
      "constructed",
      { relaxed: true },
    );
    expect(outcome?.rule).toBe("copyLimit");
    if (!outcome) {
      return;
    }
    undoRelaxedAddAction(collection, outcome, EMPTY_RUNES, "constructed");
    expect(cardsOf(collection).find((c) => c.cardId === "scorcher")?.quantity).toBe(3);
  });
});

describe("replaceCardAction", () => {
  const battlefield = (cardId: string) =>
    stubDeckBuilderCard({ cardId, cardType: "battlefield", zone: "battlefield" });

  it("swaps one battlefield for another and keeps three", () => {
    collection = createDraftCollection(["bf-0", "bf-1", "bf-2"].map((id) => battlefield(id)));
    replaceCardAction(
      collection,
      battlefield("bf-1"),
      battlefield("bf-new"),
      "battlefield",
      EMPTY_RUNES,
      "constructed",
    );
    expect(
      cardsOf(collection)
        .map((card) => card.cardId)
        .toSorted(),
    ).toEqual(["bf-0", "bf-2", "bf-new"]);
  });
});

describe("recordDeckEdit", () => {
  const resetUndo = createStoreResetter(useDeckUndoStore);
  const undoStore = () => useDeckUndoStore.getState();
  const unit = (quantity: number) =>
    stubDeckBuilderCard({ cardId: "scorcher", cardType: "unit", zone: "main", quantity });

  beforeEach(() => {
    resetUndo();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetUndo();
  });

  it("leaves no undo step when an add is rejected at the copy cap", () => {
    collection = createDraftCollection([unit(3)]);
    recordDeckEdit(collection, "deck-1", () =>
      addCardAction(collection, unit(1), "main", undefined, EMPTY_RUNES, "constructed"),
    );
    expect(undoStore().past).toEqual([]);
  });

  it("records the deck as it was before an edit that changed it", () => {
    collection = createDraftCollection([unit(1)]);
    recordDeckEdit(collection, "deck-1", () =>
      addCardAction(collection, unit(1), "main", undefined, EMPTY_RUNES, "constructed"),
    );
    expect(undoStore().past).toHaveLength(1);
    expect(undoStore().past[0]?.[0]?.quantity).toBe(1);
  });

  it("undoes a separate removal without reverting an add made just before it", () => {
    const bolt = stubDeckBuilderCard({ cardId: "bolt", cardType: "spell", zone: "main" });
    collection = createDraftCollection([bolt]);
    recordDeckEdit(collection, "deck-1", () =>
      addCardAction(collection, unit(1), "main", undefined, EMPTY_RUNES, "constructed"),
    );
    vi.advanceTimersByTime(100);
    recordDeckEdit(
      collection,
      "deck-1",
      () => removeCardAction(collection, "bolt", "main", EMPTY_RUNES, "constructed"),
      { separate: true },
    );

    const restored = undoStore().undo("deck-1", cardsOf(collection));
    expect(restored?.map((card) => card.cardId).toSorted()).toEqual(["bolt", "scorcher"]);
  });
});
