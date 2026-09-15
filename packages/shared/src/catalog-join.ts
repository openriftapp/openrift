import { splitCardBans } from "./card-ban.js";
import { isReleasedIn, todayUtc } from "./set-release.js";
import type { CatalogResponse } from "./types/api/catalog.js";
import type { Card, CardBan, Printing } from "./types/catalog.js";

export function joinCatalogCards<T extends { bans: CardBan[] }>(
  cards: Record<string, T>,
  today = todayUtc(),
): Record<string, T & Pick<Card, "upcomingBans">> {
  const joined: Record<string, T & Pick<Card, "upcomingBans">> = {};
  for (const [id, value] of Object.entries(cards)) {
    joined[id] = splitCardBans(value, today);
  }
  return joined;
}

/**
 * The browser and the API both run `filterCards` over this result, so it has
 * to produce identical rows on both sides.
 */
export function joinCatalog(catalog: CatalogResponse): {
  cardsById: Record<string, Card>;
  printings: Printing[];
} {
  const setsById = new Map(catalog.sets.map((set) => [set.id, set]));
  // One "today" for the whole join, so two printings of a set, or a card and its
  // bans, cannot land on opposite sides of a midnight that passes mid-join.
  const today = todayUtc();
  const cardsById: Record<string, Card> = joinCatalogCards(catalog.cards, today);

  const printings: Printing[] = [];
  for (const [id, value] of Object.entries(catalog.printings)) {
    const set = setsById.get(value.setId);
    const card = cardsById[value.cardId];
    if (set && card) {
      printings.push({
        ...value,
        id,
        setSlug: set.slug,
        setReleased: isReleasedIn(set.releases, value.language, today),
        card,
      });
    }
  }
  return { cardsById, printings };
}

export function joinCatalogPrintings(catalog: CatalogResponse): Printing[] {
  return joinCatalog(catalog).printings;
}
