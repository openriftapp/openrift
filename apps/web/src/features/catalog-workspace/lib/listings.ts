import { matchesCardQuery } from "@openrift/shared/card-search";
import type {
  WorkspaceListingVariant,
  WorkspaceQueueItem,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import { countNoun } from "@openrift/shared/strings";

export interface ListingCard {
  cardSlug: string;
  cardName: string;
  suggestedPrintings: number;
  withoutPrinting: number;
  variants: WorkspaceListingVariant[];
  waitingSince: string;
}

interface ListingsOverview {
  cards: ListingCard[];
  noCardCount: number;
}

export function listingsOverview(items: readonly WorkspaceQueueItem[]): ListingsOverview {
  const listings = items.filter((item) => item.reason === "listing");
  const byCard = Map.groupBy(
    listings.filter((item) => item.cardSlug !== null),
    (item) => item.cardSlug ?? "",
  );
  const cards = [...byCard].map(([cardSlug, cardItems]): ListingCard => {
    const variants = cardItems.flatMap((item) => item.variants ?? []);
    return {
      cardSlug,
      cardName: cardItems[0]?.cardName ?? cardSlug,
      suggestedPrintings: new Set(
        cardItems.filter((item) => item.segment === "open").map((item) => item.ownerId),
      ).size,
      withoutPrinting: variants.reduce((sum, variant) => sum + variant.count, 0),
      variants,
      waitingSince: cardItems
        .map((item) => item.createdAt)
        .reduce((oldest, at) => (Date.parse(at) < Date.parse(oldest) ? at : oldest)),
    };
  });
  return {
    cards: cards.toSorted(
      (a, b) =>
        Date.parse(a.waitingSince) - Date.parse(b.waitingSince) ||
        a.cardName.localeCompare(b.cardName),
    ),
    noCardCount: listings.filter((item) => item.cardSlug === null).length,
  };
}

export function listingCardSummary(card: ListingCard): string {
  return [
    card.suggestedPrintings === 0
      ? null
      : `${countNoun(card.suggestedPrintings, "printing")} with a suggestion`,
    card.withoutPrinting === 0
      ? null
      : `${countNoun(card.withoutPrinting, "listing")} without a printing`,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

export function selectListingCards(cards: readonly ListingCard[], query: string): ListingCard[] {
  return cards.filter((card) => matchesCardQuery(query, [card.cardName]));
}
