import type { ListDetailResponse } from "@openrift/shared/types/api/list";
import { useQueries, useQuery } from "@tanstack/react-query";

import { useCards } from "@/features/cards/hooks/use-cards";
import { useCollectionsList } from "@/features/collections/hooks/use-collections";
import { useCopies } from "@/features/collections/hooks/use-copies";
import { useUserTrades } from "@/features/groups/hooks/use-card-trades";
import { findOrderedCollection } from "@/features/groups/lib/buy-cart";
import type { WantedCard } from "@/features/groups/lib/wanted-cards";
import { buildWantedCards } from "@/features/groups/lib/wanted-cards";
import { listDetailQueryOptions, listsQueryOptions } from "@/features/lists/lib/lists-queries";
import { useRequiredUserId } from "@/lib/auth-session";

// Matches no collection, so the copies query stays empty until the ordered collection exists.
const NO_COLLECTION = "";

export function useWantedCards(enabled: boolean): { wanted: WantedCard[]; ready: boolean } {
  const userId = useRequiredUserId();
  const { printingsById } = useCards();
  const { data: lists } = useQuery({ ...listsQueryOptions(userId, "wish"), enabled });
  const details = useQueries({
    queries: enabled ? (lists ?? []).map((list) => listDetailQueryOptions(userId, list.id)) : [],
    combine: (results) => ({
      items: results.flatMap((result): ListDetailResponse[] =>
        result.data === undefined ? [] : [result.data],
      ),
      pending: results.some((result) => result.data === undefined),
    }),
  });
  const { data: trades } = useUserTrades();
  const orderedCollection = findOrderedCollection(useCollectionsList() ?? []);
  const { data: orderedCopies } = useCopies(orderedCollection?.id ?? NO_COLLECTION);
  if (!enabled) {
    return { wanted: [], ready: false };
  }
  const wanted = buildWantedCards(
    details.items,
    trades?.items ?? [],
    (printingId) => printingsById[printingId]?.cardId,
    orderedCopies.flatMap((copy) => {
      const cardId = printingsById[copy.printingId]?.cardId;
      return cardId === undefined ? [] : [{ printingId: copy.printingId, cardId }];
    }),
  );
  return { wanted, ready: lists !== undefined && !details.pending && trades !== undefined };
}
