import type { Card } from "./types/catalog.js";
import type { CardType } from "./types/enums.js";
import { WellKnown } from "./well-known.js";

export interface CardNameParts {
  name: string;
  types: readonly CardType[];
  tags: readonly string[];
}

export interface LegendNameParts {
  character: string | null;
  epithet: string;
}

export function legendNameParts(card: CardNameParts): LegendNameParts {
  if (!card.types.includes(WellKnown.cardType.LEGEND)) {
    return { character: null, epithet: card.name };
  }
  const character = card.tags[0];
  if (character === undefined) {
    return { character: null, epithet: card.name };
  }
  const prefix = `${character}, `;
  // Already-prefixed names ("Sett, Kingpin") pass through so composing twice can't double up.
  if (card.name.startsWith(prefix)) {
    return { character, epithet: card.name.slice(prefix.length) };
  }
  return { character, epithet: legendEpithet(card.name) };
}

export function legendDisplayName(card: CardNameParts): string {
  const { character, epithet } = legendNameParts(card);
  return character === null ? card.name : `${character}, ${epithet}`;
}

function legendEpithet(name: string): string {
  const comma = name.indexOf(", ");
  return comma === -1 ? name : name.slice(0, comma);
}

export function compareCardDisplayName(left: CardNameParts, right: CardNameParts): number {
  return legendDisplayName(left).localeCompare(legendDisplayName(right));
}

export function cardSearchAltNames(
  card: Pick<Card, "name" | "types" | "tags">,
  extra?: readonly (string | null | undefined)[],
): string[] {
  const seen = new Set<string>([card.name]);
  const out: string[] = [];
  for (const name of [legendDisplayName(card), ...(extra ?? [])]) {
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

export function deckIdentityLabels(
  legend?: Pick<Card, "name" | "types" | "tags">,
  champion?: Pick<Card, "name">,
): { character?: string; legend?: string; champion?: string } {
  const legendLabel = legend ? legendDisplayName(legend) : undefined;
  const character =
    legend !== undefined && legend.types.includes(WellKnown.cardType.LEGEND)
      ? legend.tags[0]
      : undefined;
  const prefix = character === undefined ? undefined : `${character}, `;
  if (prefix === undefined || champion === undefined || !champion.name.startsWith(prefix)) {
    return { legend: legendLabel, champion: champion?.name };
  }
  return {
    character,
    legend: legend === undefined ? undefined : legendEpithet(legend.name),
    champion: champion.name.slice(prefix.length),
  };
}

// PostgreSQL's [[:alnum:]] keeps \p{Nd}+\p{Nl} but drops other-numeric chars
// (½, ①); this regex must match it character for character.
const NAME_MATCH_KEEP = /[^\p{L}\p{Nd}\p{Nl}]/gu;

// Must match the SQL mirror (cards_set_norm_name()) character for character;
// changing this needs a migration and backfill.
export function normalizeNameForIdentity(name: string): string {
  return name.toLowerCase().replaceAll(NAME_MATCH_KEEP, "");
}
