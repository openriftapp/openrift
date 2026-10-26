import { joinCatalog } from "@openrift/shared/catalog-join";
import { cardsContract } from "@openrift/shared/contracts/cards";
import type { CardDetailRelatedCard, CardDetailResponse } from "@openrift/shared/types/api/catalog";
import type { Card, Printing } from "@openrift/shared/types/catalog";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { cardsKeys } from "@/features/cards/lib/cards-query-keys";
import { serverCacheKeys } from "@/lib/query-keys";
import { serverCache } from "@/lib/server-cache";
import { orNotFound } from "@/lib/server-fns/api-error";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

export type CardDetailPayload = CardDetailResponse & { related: CardDetailRelatedCard[] };

async function loadCardDetail(cardSlug: string): Promise<CardDetailPayload> {
  const client = apiOrpcClient(cardsContract);
  const [detail, { related }] = await Promise.all([
    orNotFound(client.detail({ cardSlug })),
    orNotFound(client.related({ cardSlug })),
  ]);
  return { ...detail, related };
}

const fetchCardDetail = createServerFn({ method: "GET" })
  .validator((input: { cardSlug: string; fresh?: boolean }) => input)
  .handler(({ data }): Promise<CardDetailPayload> => {
    if (data.fresh) {
      return loadCardDetail(data.cardSlug);
    }
    return serverCache.query({
      queryKey: serverCacheKeys.cardDetail(data.cardSlug),
      queryFn: () => loadCardDetail(data.cardSlug),
    });
  });

export function ownFaces<T extends { cardId: string }>(rows: readonly T[], cardId: string): T[] {
  return rows.filter((row) => row.cardId === cardId);
}

interface EnrichedCardDetail {
  card: Card & { id: string };
  printings: Printing[];
  sets: CardDetailResponse["sets"];
  productsByPrinting: ReadonlyMap<string, CardDetailResponse["products"]>;
  related: CardDetailRelatedCard[];
}

function enrichCardDetail(response: CardDetailPayload): EnrichedCardDetail {
  const { id, ...cardValue } = response.card;
  const { cardsById, printings } = joinCatalog({
    sets: response.sets,
    cards: { ...response.cards, [id]: cardValue },
    printings: response.printings,
    markers: response.markers,
    distributionChannels: response.distributionChannels,
  });
  // oxlint-disable-next-line typescript/no-non-null-assertion -- joined from `cardValue` one line up
  const card = { ...cardsById[id]!, id };
  return {
    card,
    printings: ownFaces(printings, id),
    sets: response.sets,
    // The API sends products flat (one row per printing+product) already
    // ordered by product name; grouping preserves that order per printing.
    productsByPrinting: Map.groupBy(response.products, (p) => p.printingId),
    related: response.related,
  };
}

export function cardDetailQueryOptions(cardSlug: string) {
  return queryOptions({
    queryKey: cardsKeys.detail(cardSlug),
    queryFn: () => fetchCardDetail({ data: { cardSlug } }),
    staleTime: 5 * 60 * 1000,
    select: enrichCardDetail,
  });
}

/**
 * Same payload, past the SSR server cache's one-minute window, so an admin
 * preview reflects a save right after it lands.
 */
export function freshCardDetailQueryOptions(cardSlug: string) {
  return queryOptions({
    queryKey: cardsKeys.detailFresh(cardSlug),
    queryFn: () => fetchCardDetail({ data: { cardSlug, fresh: true } }),
    staleTime: 0,
    select: enrichCardDetail,
  });
}
