import { legendDisplayName, legendNameParts } from "@openrift/shared/card-name";
import type { PublicDeckCardResponse } from "@openrift/shared/types/api/deck";
import { WellKnown } from "@openrift/shared/well-known";

export interface ArchivedDeckIdentity {
  cardId: string;
  name: string;
  character: string | null;
  epithet: string;
  slug: string;
  domains: string[];
}

/** Domains come from the card list; the meta contract's card refs don't carry them. */
export function archivedDeckIdentity(
  cards: readonly PublicDeckCardResponse[],
): ArchivedDeckIdentity | null {
  const named =
    cards.find((card) => card.zone === WellKnown.deckZone.LEGEND) ??
    cards.find((card) => card.zone === WellKnown.deckZone.CHAMPION);
  if (!named) {
    return null;
  }
  const nameParts = { name: named.cardName, types: named.cardTypes, tags: named.tags };
  return {
    cardId: named.cardId,
    name: legendDisplayName(nameParts),
    ...legendNameParts(nameParts),
    slug: named.cardSlug,
    domains: named.domains,
  };
}
