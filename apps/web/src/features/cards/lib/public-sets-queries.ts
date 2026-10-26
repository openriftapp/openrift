import { joinCatalogCards } from "@openrift/shared/catalog-join";
import { setsContract } from "@openrift/shared/contracts/sets";
import { todayUtc } from "@openrift/shared/format-date";
import { isReleasedIn } from "@openrift/shared/set-release";
import type { SetDetailResponse, SetListResponse } from "@openrift/shared/types/api/catalog";
import type { Card, Printing } from "@openrift/shared/types/catalog";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { setsKeys } from "@/features/cards/lib/cards-query-keys";
import { serverCacheKeys } from "@/lib/query-keys";
import { serverCache } from "@/lib/server-cache";
import { orNotFound } from "@/lib/server-fns/api-error";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchSetList = createServerFn({ method: "GET" }).handler((): Promise<SetListResponse> =>
  serverCache.query({
    queryKey: serverCacheKeys.sets,
    queryFn: () => apiOrpcClient(setsContract).list(),
  }),
);

const fetchSetDetail = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .handler(({ data }): Promise<SetDetailResponse> =>
    serverCache.query({
      queryKey: serverCacheKeys.setDetail(data),
      queryFn: () => orNotFound(apiOrpcClient(setsContract).detail({ setSlug: data })),
    }),
  );

interface EnrichedSetDetail {
  set: SetDetailResponse["set"];
  printings: Printing[];
  cards: Record<string, SetDetailResponse["cards"][string] & Pick<Card, "upcomingBans">>;
}

function enrichSetDetail(response: SetDetailResponse): EnrichedSetDetail {
  const today = todayUtc();
  const cards = joinCatalogCards(response.cards, today);
  const printings: Printing[] = response.printings.flatMap((p) => {
    const card = cards[p.cardId];
    return card
      ? [
          {
            ...p,
            setSlug: response.set.slug,
            setReleased: isReleasedIn(response.set.releases, p.language, today),
            card,
          },
        ]
      : [];
  });
  return { set: response.set, printings, cards };
}

export const publicSetListQueryOptions = queryOptions({
  queryKey: setsKeys.all,
  queryFn: () => fetchSetList(),
  staleTime: 5 * 60 * 1000,
});

export function publicSetDetailQueryOptions(setSlug: string) {
  return queryOptions({
    queryKey: setsKeys.detail(setSlug),
    queryFn: () => fetchSetDetail({ data: setSlug }),
    staleTime: 5 * 60 * 1000,
    select: enrichSetDetail,
  });
}
