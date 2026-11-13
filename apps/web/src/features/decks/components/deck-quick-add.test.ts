import type { CardType, DeckZone, Domain, SuperType } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { describe, expect, it } from "vitest";

import { buildTargets } from "@/features/decks/components/deck-quick-add";
import { stubDeckBuilderCard } from "@/test/factories";
import { TEST_ZONE_LABELS } from "@/test/zone-order-stub";

const CONSTRUCTED = WellKnown.deckFormat.CONSTRUCTED;
const FREEFORM = WellKnown.deckFormat.FREEFORM;

function legendInDeck(domains: Domain[] = ["fury"] as Domain[]) {
  return stubDeckBuilderCard({
    cardTypes: ["legend" as CardType],
    zone: "legend" as DeckZone,
    domains,
    energy: null,
    power: null,
  });
}

describe("buildTargets", () => {
  it("offers a legend card the single set action in constructed", () => {
    const legend = stubDeckBuilderCard({ cardTypes: ["legend" as CardType] });
    const targets = buildTargets(legend, [], CONSTRUCTED, TEST_ZONE_LABELS);
    expect(targets).toEqual([
      {
        zone: WellKnown.deckZone.LEGEND,
        label: "Set as Legend",
        kind: "legend",
        disabled: false,
        count: 0,
      },
    ]);
  });

  it("labels the legend action as a switch when one is already set", () => {
    const legend = stubDeckBuilderCard({ cardTypes: ["legend" as CardType] });
    const targets = buildTargets(legend, [legendInDeck()], CONSTRUCTED, TEST_ZONE_LABELS);
    expect(targets[0]?.label).toBe("Switch Legend");
  });

  it("offers main and sideboard to a plain unit", () => {
    const unit = stubDeckBuilderCard({ cardTypes: ["unit" as CardType] });
    const targets = buildTargets(unit, [], CONSTRUCTED, TEST_ZONE_LABELS);
    expect(targets.map((target) => target.zone)).toEqual([
      WellKnown.deckZone.MAIN,
      WellKnown.deckZone.SIDEBOARD,
    ]);
    expect(targets.every((target) => !target.disabled)).toBe(true);
  });

  it("leads with the champion zone for champion-eligible units", () => {
    const champion = stubDeckBuilderCard({
      cardTypes: ["unit" as CardType],
      superTypes: ["champion" as SuperType],
    });
    const targets = buildTargets(champion, [], CONSTRUCTED, TEST_ZONE_LABELS);
    expect(targets.map((target) => target.zone)).toEqual([
      WellKnown.deckZone.CHAMPION,
      WellKnown.deckZone.MAIN,
      WellKnown.deckZone.SIDEBOARD,
    ]);
  });

  it("disables zones once the cross-zone copy cap is reached", () => {
    const unit = stubDeckBuilderCard({ cardTypes: ["unit" as CardType] });
    const inDeck = stubDeckBuilderCard({
      cardId: unit.cardId,
      cardTypes: ["unit" as CardType],
      zone: "main" as DeckZone,
      quantity: 3,
    });
    const targets = buildTargets(unit, [inDeck], CONSTRUCTED, TEST_ZONE_LABELS);
    expect(targets.find((target) => target.zone === WellKnown.deckZone.MAIN)).toMatchObject({
      disabled: true,
      count: 3,
    });
  });

  it("counts existing copies in the target zone", () => {
    const unit = stubDeckBuilderCard({ cardTypes: ["unit" as CardType] });
    const inDeck = stubDeckBuilderCard({
      cardId: unit.cardId,
      cardTypes: ["unit" as CardType],
      zone: "main" as DeckZone,
      quantity: 2,
    });
    const targets = buildTargets(unit, [inDeck], CONSTRUCTED, TEST_ZONE_LABELS);
    expect(targets.find((target) => target.zone === WellKnown.deckZone.MAIN)?.count).toBe(2);
  });

  it("disables the rune zone when the rune deck is full for that domain", () => {
    const rune = stubDeckBuilderCard({
      cardTypes: ["rune" as CardType],
      domains: ["calm"] as Domain[],
      energy: null,
    });
    const fullRunes = stubDeckBuilderCard({
      cardTypes: ["rune" as CardType],
      zone: "runes" as DeckZone,
      domains: ["fury"] as Domain[],
      quantity: 12,
    });
    const targets = buildTargets(rune, [legendInDeck(), fullRunes], CONSTRUCTED, TEST_ZONE_LABELS);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ zone: WellKnown.deckZone.RUNES, disabled: true });
  });

  it("keeps the rune zone open at 12 when a two-domain legend lets the add swap a rune out", () => {
    const rune = stubDeckBuilderCard({
      cardTypes: ["rune" as CardType],
      domains: ["fury"] as Domain[],
      energy: null,
    });
    const runes = (domain: string) =>
      stubDeckBuilderCard({
        cardTypes: ["rune" as CardType],
        zone: "runes" as DeckZone,
        domains: [domain] as Domain[],
        quantity: 6,
      });
    const targets = buildTargets(
      rune,
      [legendInDeck(["fury", "calm"] as Domain[]), runes("fury"), runes("calm")],
      CONSTRUCTED,
      TEST_ZONE_LABELS,
    );
    expect(targets[0]).toMatchObject({ zone: WellKnown.deckZone.RUNES, disabled: false });
  });

  it("disables the rune zone at 12 when the deck has no legend to swap against", () => {
    const rune = stubDeckBuilderCard({
      cardTypes: ["rune" as CardType],
      domains: ["fury"] as Domain[],
      energy: null,
    });
    const fullRunes = stubDeckBuilderCard({
      cardTypes: ["rune" as CardType],
      zone: "runes" as DeckZone,
      domains: ["fury"] as Domain[],
      quantity: 12,
    });
    const targets = buildTargets(rune, [fullRunes], CONSTRUCTED, TEST_ZONE_LABELS);
    expect(targets[0]).toMatchObject({ zone: WellKnown.deckZone.RUNES, disabled: true });
  });

  it("disables a duplicate battlefield", () => {
    const battlefield = stubDeckBuilderCard({ cardTypes: ["battlefield" as CardType] });
    const inDeck = stubDeckBuilderCard({
      cardId: battlefield.cardId,
      cardTypes: ["battlefield" as CardType],
      zone: "battlefield" as DeckZone,
    });
    const targets = buildTargets(battlefield, [inDeck], CONSTRUCTED, TEST_ZONE_LABELS);
    expect(targets[0]).toMatchObject({ zone: WellKnown.deckZone.BATTLEFIELD, disabled: true });
  });

  it("treats legends as a plain zone add in freeform with nothing disabled", () => {
    const legend = stubDeckBuilderCard({ cardTypes: ["legend" as CardType] });
    const targets = buildTargets(legend, [legendInDeck()], FREEFORM, TEST_ZONE_LABELS);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      zone: WellKnown.deckZone.LEGEND,
      kind: "add",
      disabled: false,
    });
  });
});
