interface KeyedCard {
  key: string;
}

// Recycles the set-aside cards to the library bottom in random order (rules 118, Recycle).
export function applyMulligan<Card extends KeyedCard>(
  hand: readonly Card[],
  library: readonly Card[],
  selectedKeys: ReadonlySet<string>,
  randomize: (cards: readonly Card[]) => Card[],
): { hand: Card[]; library: Card[] } {
  const kept = hand.filter((card) => !selectedKeys.has(card.key));
  const returned = hand.filter((card) => selectedKeys.has(card.key));
  const drawn = library.slice(0, returned.length);
  return {
    hand: [...kept, ...drawn],
    library: [...library.slice(returned.length), ...randomize(returned)],
  };
}
