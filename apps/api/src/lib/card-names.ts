export interface CardNameIndex {
  cardIdByNorm: Map<string, string>;
  /** Consulted after `cardIdByNorm`: a card's own name wins over another card's alias. */
  cardIdByAliasNorm: Map<string, string>;
}

export function buildCardNameIndex(sources: {
  cardNorms: readonly { id: string; normName: string }[];
  aliases: readonly { cardId: string; normName: string }[];
}): CardNameIndex {
  // A shared own name goes to the lowest id, the same tiebreak `liveCardForNorm` uses.
  const cardIdByNorm = new Map<string, string>();
  for (const card of sources.cardNorms) {
    const held = cardIdByNorm.get(card.normName);
    if (held === undefined || card.id < held) {
      cardIdByNorm.set(card.normName, card.id);
    }
  }
  return {
    cardIdByNorm,
    cardIdByAliasNorm: new Map(sources.aliases.map((alias) => [alias.normName, alias.cardId])),
  };
}

export function resolveCardIdByNorm(index: CardNameIndex, normName: string): string | null {
  if (normName === "") {
    return null;
  }
  return index.cardIdByNorm.get(normName) ?? index.cardIdByAliasNorm.get(normName) ?? null;
}

export function cardNameKeys(ownNorm: string, aliases: readonly { normName: string }[]): string[] {
  return [...new Set([ownNorm, ...aliases.map((alias) => alias.normName)])].filter(
    (key) => key !== "",
  );
}
