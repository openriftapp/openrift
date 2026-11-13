import type { MetaDeckCardsQuery } from "@openrift/shared/types/api/meta";

import { useCards } from "@/features/cards/hooks/use-cards";
import { useMetaDeckCards } from "@/features/meta/hooks/use-meta";
import type { MetaBanGroup } from "@/features/meta/lib/meta-deck-bans";
import { metaDeckBans } from "@/features/meta/lib/meta-deck-bans";
import { decodeMetaDeckCardIndex } from "@/features/meta/lib/meta-deck-collection";

/** Suspends on the deck card index and the catalog; mount under `useHydrated` and Suspense. */
export function useMetaDeckBans(decks?: MetaDeckCardsQuery): ReadonlyMap<string, MetaBanGroup[]> {
  const { data: index } = useMetaDeckCards(decks);
  const { cardsById } = useCards();
  return metaDeckBans(decodeMetaDeckCardIndex(index), cardsById);
}
