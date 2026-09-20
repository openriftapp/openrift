import { WellKnown } from "@openrift/shared/well-known";
import { and, inArray, not, eq, useLiveQuery } from "@tanstack/react-db";

import { useCards } from "@/features/cards/hooks/use-cards";
import { useCollectionsList } from "@/features/collections/hooks/use-collections";
import { useCopiesCollection } from "@/features/collections/hooks/use-copies-collection";
import { useDeckCardsCollection } from "@/features/decks/hooks/use-decks-collections";
import type { DeckBoxPlan } from "@/features/decks/lib/deck-box";
import { computeDeckBoxPlan } from "@/features/decks/lib/deck-box";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { useEffectiveLanguageOrder } from "@/hooks/use-effective-language-order";
import { useConditionList } from "@/hooks/use-enums";
import { useUserId } from "@/lib/auth-session";

/** SSR-unsafe (reads the copies collection through `useLiveQuery`); mount consumers behind `useHydrated`. */
export function useDeckBox(
  deckId: string,
  cards: readonly DeckBuilderCard[],
  homeCollectionId: string | null | undefined,
  pinnedCopyIds?: ReadonlySet<string>,
): DeckBoxPlan | undefined {
  const userId = useUserId();
  const enabled = Boolean(userId) && Boolean(homeCollectionId);
  const copiesCollection = useCopiesCollection();
  const { printingsByCardId, printingsById } = useCards();
  const languageOrder = useEffectiveLanguageOrder();
  const conditions = useConditionList();

  const collections = useCollectionsList();
  const { data: copies } = useLiveQuery({
    query: (q) => (enabled && copiesCollection ? q.from({ copy: copiesCollection }) : null),
  });

  // Cards claimed by another deck sharing this box must be excluded before computing surplus.
  const sharingDeckIds =
    collections
      ?.find((collection) => collection.id === homeCollectionId)
      ?.homeDecks.filter((deck) => deck.id !== deckId)
      .map((deck) => deck.id) ?? [];

  const cardsCollection = useDeckCardsCollection();
  const { data: deckCards, isReady: deckCardsReady } = useLiveQuery({
    query: (q) =>
      enabled && cardsCollection && sharingDeckIds.length > 0
        ? q
            .from({ card: cardsCollection })
            .where(({ card }) =>
              and(
                inArray(card.deckId, sharingDeckIds),
                not(eq(card.zone, WellKnown.deckZone.OVERFLOW)),
              ),
            )
        : null,
  });

  const awaitingDeckCards = sharingDeckIds.length > 0 && !deckCardsReady;
  if (!homeCollectionId || !copies || !collections || awaitingDeckCards) {
    return undefined;
  }

  const otherDeckNeeds = new Map<string, number>();
  for (const card of deckCards ?? []) {
    otherDeckNeeds.set(card.cardId, (otherDeckNeeds.get(card.cardId) ?? 0) + card.quantity);
  }

  return computeDeckBoxPlan({
    cards,
    copies,
    homeCollectionId,
    printingsByCardId,
    printingsById,
    collectionNameById: new Map(collections.map((collection) => [collection.id, collection.name])),
    otherDeckNeeds,
    languageOrder,
    conditionOrder: conditions.map((condition) => condition.slug),
    pinnedCopyIds,
  });
}
