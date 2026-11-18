import type { MetaDeckCardsQuery } from "@openrift/shared/types/api/meta";
import { useQuery } from "@tanstack/react-query";

import { useCatalogOnDemand } from "@/features/cards/hooks/use-cards";
import type { MetaBanGroup } from "@/features/meta/lib/meta-deck-bans";
import { metaDeckBans } from "@/features/meta/lib/meta-deck-bans";
import { decodeMetaDeckCardIndex } from "@/features/meta/lib/meta-deck-collection";
import { metaDeckCardsQueryOptions } from "@/features/meta/lib/meta-queries";

/** Undefined until the deck cards and the catalogue have landed; never suspends. */
export function useMetaDeckBans(
  decks: MetaDeckCardsQuery | undefined,
  enabled: boolean,
): ReadonlyMap<string, MetaBanGroup[]> | undefined {
  const { data: index } = useQuery({ ...metaDeckCardsQueryOptions(decks), enabled });
  const { catalog } = useCatalogOnDemand(enabled);
  if (!enabled || index === undefined || catalog === undefined) {
    return undefined;
  }
  return metaDeckBans(decodeMetaDeckCardIndex(index), catalog.cardsById);
}
