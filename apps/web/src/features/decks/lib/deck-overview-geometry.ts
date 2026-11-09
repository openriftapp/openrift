import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";

/**
 * Geometry for the deck overview's grid: the shared card width and the
 * small-zone row's column spans.
 *
 * Sibling of `deck-thumb-metrics.ts`, which owns the two thumb sizes. Both read
 * `--deck-card-w`, the single measured card width the overview publishes on its
 * content wrapper.
 */

/** Zones whose cards are landscape (battlefield art is rotated). */
export const LANDSCAPE_ZONES: ReadonlySet<DeckZone> = new Set([WellKnown.deckZone.BATTLEFIELD]);

export const SMALL_ZONES: DeckZone[] = [
  WellKnown.deckZone.LEGEND,
  WellKnown.deckZone.CHAMPION,
  WellKnown.deckZone.RUNES,
  WellKnown.deckZone.BATTLEFIELD,
];

// Must stay in step with the gap-1.5 class between thumbs; the card width is derived from it.
export const DECK_GRID_GAP = 6;

// Small enough that a phone always gets two cards per row before the SSR paint measures.
export const UNMEASURED_CARD_WIDTH = "min(11rem, 40vw)";

const PHONE_CARDS_PER_ROW: Partial<Record<DeckZone, number>> = {
  [WellKnown.deckZone.LEGEND]: 3,
  [WellKnown.deckZone.LEGEND_OPTIONS]: 3,
  [WellKnown.deckZone.CHAMPION]: 3,
  [WellKnown.deckZone.BATTLEFIELD]: 2,
};
/** Card width in px for a zone on a phone, where each zone fills its own row. */
export function phoneZoneCardWidth(
  zone: DeckZone,
  containerWidth: number,
  defaultPerRow = 4,
): number {
  const perRow = PHONE_CARDS_PER_ROW[zone] ?? defaultPerRow;
  const slot = (containerWidth - (perRow - 1) * DECK_GRID_GAP) / perRow;
  // Landscape thumbs render at width * 88/63, so the row count applies to that.
  const width = LANDSCAPE_ZONES.has(zone) ? (slot * 63) / 88 : slot;
  return Math.max(0, Math.floor(width));
}

export function smallZoneGridStyles(
  columns: number,
): Partial<Record<DeckZone, React.CSSProperties>> {
  const runeSpan = columns >= 4 ? columns - 2 : columns;
  return {
    legend: { gridColumn: "span 1 / span 1" },
    champion: { gridColumn: "span 1 / span 1" },
    runes: { gridColumn: `span ${runeSpan} / span ${runeSpan}` },
    battlefield: { gridColumn: "1 / -1" },
  };
}
