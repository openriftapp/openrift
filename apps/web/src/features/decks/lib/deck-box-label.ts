import { m } from "@/paraglide/messages.js";

interface NamedDeck {
  name: string;
}

/**
 * Two decks are both named; beyond that the count carries more than a
 * truncated list would.
 */
export function deckBoxLabel(homeDecks: readonly NamedDeck[]): string | undefined {
  const [first, second] = homeDecks;
  if (!first) {
    return undefined;
  }
  if (!second) {
    return m.decks_overview_box_label_one({ name: first.name });
  }
  if (homeDecks.length === 2) {
    return m.decks_overview_box_label_two({ first: first.name, second: second.name });
  }
  return m.decks_overview_box_label_many({ count: homeDecks.length });
}

export function sharedBoxWarning(
  collectionName: string,
  otherDecks: readonly NamedDeck[],
): string | undefined {
  const [first] = otherDecks;
  if (!first) {
    return undefined;
  }
  if (otherDecks.length === 1) {
    return m.decks_overview_box_shared_one({ collection: collectionName, deck: first.name });
  }
  return m.decks_overview_box_shared_many({
    collection: collectionName,
    count: otherDecks.length,
  });
}
