import { SIDEBOARD_MAXIMUM } from "@openrift/shared/deck-rules";
import type { DeckFormat, DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";

import { m } from "@/paraglide/messages.js";

export {
  REQUIRED_ZONES,
  ZONE_LABELS,
  requiredZoneProgress,
  zoneExpected,
  zoneLabel,
} from "@openrift/shared/deck-zones";

/** Prefer `zoneEmptyHint` — this misses the Custom-Region battlefield override. */
export function zoneEmptyHints(): Record<DeckZone, string> {
  return {
    legend: m.decks_zone_empty_legend(),
    champion: m.decks_zone_empty_champion(),
    runes: m.decks_zone_empty_runes(),
    battlefield: m.decks_zone_empty_battlefield(),
    main: m.decks_zone_empty_main(),
    sideboard: m.decks_zone_empty_sideboard({ max: SIDEBOARD_MAXIMUM }),
    overflow: m.decks_zone_empty_overflow(),
  };
}

export function zoneEmptyHint(zone: DeckZone, format: DeckFormat): string {
  if (zone === WellKnown.deckZone.BATTLEFIELD && format === WellKnown.deckFormat.CUSTOM_REGION) {
    return m.decks_zone_empty_battlefield_single();
  }
  return zoneEmptyHints()[zone];
}

export function zoneEmptyReadOnlyLabel(zone: DeckZone): string {
  const labels: Record<DeckZone, string> = {
    legend: m.decks_zone_readonly_legend(),
    champion: m.decks_zone_readonly_champion(),
    runes: m.decks_zone_readonly_runes(),
    battlefield: m.decks_zone_readonly_battlefield(),
    main: m.decks_zone_readonly_main(),
    sideboard: m.decks_zone_readonly_sideboard(),
    overflow: m.decks_zone_readonly_overflow(),
  };
  return labels[zone];
}
