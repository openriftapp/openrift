import { splitCardBans } from "./card-ban.js";
import { todayUtc } from "./format-date.js";
import { isReleasedIn } from "./set-release.js";
import type { CatalogPrintingResponse, CatalogResponse } from "./types/api/catalog.js";
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
  for (const [printingId, { side2, ...value }] of Object.entries(catalog.printings)) {
    const sides = side2 === undefined ? [value] : [value, { ...value, ...side2 }];
    const cards = sides.map((side) => cardsById[side.cardId]);
    sides.forEach((side, index) => {
      const set = setsById.get(side.setId);
      const card = cards[index];
      if (!set || !card) {
        return;
      }
      const other = sides.length === 2 ? sides[1 - index] : undefined;
      const otherCard = sides.length === 2 ? cards[1 - index] : undefined;
      const otherImageId = other?.images[0]?.imageId;
      printings.push({
        ...side,
        printingId,
        side: index === 0 ? 1 : 2,
        faceId: side.faceId ?? printingId,
        ...(other && otherCard
          ? {
              otherSide: {
                faceId: other.faceId ?? printingId,
                cardId: other.cardId,
                cardName: otherCard.name,
                cardSlug: otherCard.slug,
                ...(otherImageId === undefined ? {} : { imageId: otherImageId }),
              },
            }
          : {}),
        setSlug: set.slug,
        setReleased: isReleasedIn(set.releases, side.language, today),
        card,
      });
    });
  }
  return { cardsById, printings };
}

/** Joins side entries from an array endpoint, which already carry their pairing. */
export function joinPrintingSides(
  entries: readonly CatalogPrintingResponse[],
  sets: CatalogResponse["sets"],
  cardsById: Record<string, Card>,
  today = todayUtc(),
): Printing[] {
  const setsById = new Map(sets.map((set) => [set.id, set]));
  const printings: Printing[] = [];
  for (const entry of entries) {
    const set = setsById.get(entry.setId);
    const card = cardsById[entry.cardId];
    if (set && card) {
      printings.push({
        ...entry,
        setSlug: set.slug,
        setReleased: isReleasedIn(set.releases, entry.language, today),
        card,
      });
    }
  }
  return printings;
}

export function joinCatalogPrintings(catalog: CatalogResponse): Printing[] {
  return joinCatalog(catalog).printings;
}
