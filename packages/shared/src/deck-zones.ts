import { formatHasSideboard, requiredLegendOptions } from "./deck-rules.js";
import type { DeckFormat, DeckZone } from "./types/enums.js";
import { WellKnown } from "./well-known.js";

/**
 * Display labels. The zone headers in the text interchange format are a
 * separate vocabulary owned by `deck-codecs/text.ts`.
 */
export const ZONE_LABELS: Record<DeckZone, string> = {
  legend: "Legend",
  "legend-options": "Legend Options",
  champion: "Chosen Champion",
  runes: "Runes",
  battlefield: "Battlefields",
  main: "Main Deck",
  sideboard: "Sideboard",
  overflow: "Overflow",
};

export function zoneLabel(zone: string): string {
  return ZONE_LABELS[zone as DeckZone] ?? zone;
}

/** Prefer `zoneExpected`; this omits the per-format overrides. */
export const ZONE_EXPECTED: Partial<Record<DeckZone, number>> = {
  legend: 1,
  champion: 1,
  runes: 12,
  battlefield: 3,
  main: 39,
};

interface ZoneCard {
  zone: DeckZone;
  quantity: number;
  additionalLegendCount?: number | null;
}

/** Legend Options has a target only when `cards` is given and a card in it grants extra legends. */
export function zoneExpected(
  zone: DeckZone,
  format: DeckFormat,
  cards?: readonly ZoneCard[],
): number | undefined {
  if (zone === WellKnown.deckZone.BATTLEFIELD && format === WellKnown.deckFormat.CUSTOM_REGION) {
    return 1;
  }
  if (zone === WellKnown.deckZone.LEGEND_OPTIONS) {
    const required = cards ? requiredLegendOptions(cards) : 0;
    return required > 0 ? required : undefined;
  }
  if (zone === WellKnown.deckZone.SIDEBOARD && !formatHasSideboard(format)) {
    return undefined;
  }
  return ZONE_EXPECTED[zone];
}

/**
 * An empty sideboard hides without a sideboard format, empty Legend Options without a granting
 * card; either stays shown while it holds cards, so its violation surfaces and they can move out.
 */
export function isZoneShown(
  zone: DeckZone,
  format: DeckFormat,
  cards: readonly ZoneCard[],
): boolean {
  const holdsCards = () => cards.some((card) => card.zone === zone && card.quantity > 0);
  if (zone === WellKnown.deckZone.SIDEBOARD) {
    return formatHasSideboard(format) || holdsCards();
  }
  if (zone === WellKnown.deckZone.LEGEND_OPTIONS) {
    return requiredLegendOptions(cards) > 0 || holdsCards();
  }
  return true;
}

export function isCountedZone(zone: string): boolean {
  return zone !== WellKnown.deckZone.OVERFLOW;
}

export const REQUIRED_ZONES: readonly DeckZone[] = [
  WellKnown.deckZone.LEGEND,
  WellKnown.deckZone.CHAMPION,
  WellKnown.deckZone.RUNES,
  WellKnown.deckZone.BATTLEFIELD,
  WellKnown.deckZone.MAIN,
];

/**
 * Lives here so the deck-list endpoint and the deck page compute the same
 * figure.
 */
export function requiredZoneProgress(
  cards: readonly { zone: DeckZone; quantity: number }[],
  format: DeckFormat,
): { progress: number; total: number } {
  const progress = cards
    .filter((card) => REQUIRED_ZONES.includes(card.zone))
    .reduce((sum, card) => sum + card.quantity, 0);
  const total = REQUIRED_ZONES.reduce((sum, zone) => sum + (zoneExpected(zone, format) ?? 0), 0);
  return { progress, total };
}
