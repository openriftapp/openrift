import type { PublicDeckCardResponse } from "@openrift/shared/types/api/deck";
import { legendDisplayName } from "@openrift/shared/utils";
import { WellKnown } from "@openrift/shared/well-known";

export interface ArchivedDeckIdentity {
  cardId: string;
  name: string;
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
  return {
    cardId: named.cardId,
    name: legendDisplayName({ name: named.cardName, types: named.cardTypes, tags: named.tags }),
    slug: named.cardSlug,
    domains: named.domains,
  };
}
