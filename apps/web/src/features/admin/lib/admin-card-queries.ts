import { adminCardQueriesContract } from "@openrift/shared/contracts/admin/card-queries";
import type { AllCardsResponse } from "@openrift/shared/contracts/admin/card-queries";
import type { ErrataAnnouncement } from "@openrift/shared/contracts/errata";
import type { CandidateCardSummaryResponse } from "@openrift/shared/types/api/admin";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

// The detail schemas contain `z.unknown()` fields, which createServerFn's serializable return check rejects.
type LooseDetail = Record<string, any>;

const fetchAdminCardList = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<CandidateCardSummaryResponse[]> =>
    apiOrpcClient(adminCardQueriesContract, context.cookie).listCandidates(),
  );

export const adminCardListQueryOptions = queryOptions({
  queryKey: adminKeys.cards.list,
  queryFn: () => fetchAdminCardList(),
  staleTime: 5 * 60 * 1000,
});

const fetchAllCards = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AllCardsResponse> =>
    apiOrpcClient(adminCardQueriesContract, context.cookie).allCards(),
  );

export const allCardsQueryOptions = queryOptions({
  queryKey: adminKeys.cards.allCards,
  queryFn: () => fetchAllCards(),
  staleTime: 5 * 60 * 1000,
});

const fetchErrataAnnouncements = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<ErrataAnnouncement[]> =>
    apiOrpcClient(adminCardQueriesContract, context.cookie).errataAnnouncements(),
  );

export const errataAnnouncementsQueryOptions = queryOptions({
  queryKey: adminKeys.cards.errataAnnouncements,
  queryFn: () => fetchErrataAnnouncements(),
  staleTime: 5 * 60 * 1000,
});

const fetchAdminCardDetail = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(
    ({ context, data: cardSlug }) =>
      apiOrpcClient(adminCardQueriesContract, context.cookie).getCandidateCard({
        cardSlug,
      }) as Promise<LooseDetail>,
  );

const REHOST_POLL_INTERVAL_MS = 3000;

/**
 * Rehosting runs as a fire-and-forget background job, so `rehostedUrl` stays
 * null until it finishes. Images with no `originalUrl` can never be rehosted
 * and are ignored, or polling would never stop.
 */
export function hasPendingRehost(data?: {
  printingImages?: readonly { originalUrl: string | null; rehostedUrl: string | null }[];
}): boolean {
  return (
    data?.printingImages?.some(
      (image) => image.originalUrl !== null && image.rehostedUrl === null,
    ) ?? false
  );
}

export function adminCardDetailQueryOptions(cardSlug: string) {
  return queryOptions({
    queryKey: adminKeys.cards.detail(cardSlug),
    queryFn: () => fetchAdminCardDetail({ data: cardSlug }),
    staleTime: 5 * 60 * 1000,
    refetchInterval: (query) =>
      hasPendingRehost(query.state.data) ? REHOST_POLL_INTERVAL_MS : false,
  });
}

const fetchUnmatchedCardDetail = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(
    ({ context, data: name }) =>
      apiOrpcClient(adminCardQueriesContract, context.cookie).getUnmatchedDetail({
        name,
      }) as Promise<LooseDetail>,
  );

export function unmatchedCardDetailQueryOptions(name: string) {
  return queryOptions({
    queryKey: adminKeys.cards.unmatched(name),
    queryFn: () => fetchUnmatchedCardDetail({ data: name }),
  });
}
