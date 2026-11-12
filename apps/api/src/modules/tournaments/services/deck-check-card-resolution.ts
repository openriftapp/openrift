import { normalizeNameForIdentity } from "@openrift/shared/card-name";
import { resolveCard } from "@openrift/shared/card-search";

import type { Repos } from "../../../deps.js";
import { createCardLookupIndexLoader } from "../../catalog/lib/card-lookup-index.js";
import type { CardResolution } from "../repositories/deck-check-entry-cards.js";

interface CardResolutionInput {
  name: string;
}

/** An identity key to collapse repeated spellings in a batch, not a search key. */
export function cardResolutionKey(name: string): string {
  return normalizeNameForIdentity(name);
}

const UNMATCHED: CardResolution = {
  resolvedCardId: null,
  resolvedPrintingId: null,
  matchStatus: "unmatched",
};

const AMBIGUOUS: CardResolution = {
  resolvedCardId: null,
  resolvedPrintingId: null,
  matchStatus: "ambiguous",
};

/**
 * Runs against the shared in-memory lookup index, so a name that finds a card
 * in a picker, in chat or in the Discord bot finds the same card here.
 */
export async function resolveDeckCheckCards(
  repos: Repos,
  inputs: CardResolutionInput[],
): Promise<Map<string, CardResolution>> {
  const results = new Map<string, CardResolution>();
  // Deduplicated by identity key, but resolved from the raw name: the key
  // strips the punctuation the matcher wants to see.
  const byKey = new Map<string, string>();
  for (const input of inputs) {
    const key = cardResolutionKey(input.name);
    if (!byKey.has(key)) {
      byKey.set(key, input.name);
    }
  }
  if (byKey.size === 0) {
    return results;
  }

  const index = await createCardLookupIndexLoader(repos)();
  const matchedCardByKey = new Map<string, string>();
  for (const [key, name] of byKey) {
    const resolution = resolveCard(index, name);
    if (resolution.status === "matched") {
      matchedCardByKey.set(key, resolution.card.id);
    } else {
      results.set(key, resolution.status === "ambiguous" ? AMBIGUOUS : UNMATCHED);
    }
  }

  const thumbnailByCard = await repos.deckCheck.canonicalPrintingByCard([
    ...new Set(matchedCardByKey.values()),
  ]);
  for (const [key, cardId] of matchedCardByKey) {
    results.set(key, {
      resolvedCardId: cardId,
      resolvedPrintingId: thumbnailByCard.get(cardId) ?? null,
      matchStatus: "matched",
    });
  }

  return results;
}
