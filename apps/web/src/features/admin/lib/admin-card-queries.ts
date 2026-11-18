import { adminCardQueriesContract } from "@openrift/shared/contracts/admin/card-queries";
import type { AllCardsResponse } from "@openrift/shared/contracts/admin/card-queries";
import type { ErrataAnnouncement } from "@openrift/shared/contracts/errata";
import { MINUTE_MS } from "@openrift/shared/format-date";
import type {
  AdminCardDetailResponse,
  CandidateCardResponse,
  CandidateCardSummaryResponse,
  CandidatePrintingResponse,
  UnmatchedCardDetailResponse,
} from "@openrift/shared/types/api/admin";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type WithJsonExtraData<T extends { extraData: unknown }> = Omit<T, "extraData"> & {
  extraData: JsonValue;
};

interface SourceLists {
  sources: WithJsonExtraData<CandidateCardResponse>[];
  candidatePrintings: WithJsonExtraData<CandidatePrintingResponse>[];
}

/** The detail with `extraData` as JSON: createServerFn's serializable return check rejects `unknown`. */
export type AdminCardDetail = Omit<AdminCardDetailResponse, keyof SourceLists> & SourceLists;
export type UnmatchedCardDetail = Omit<UnmatchedCardDetailResponse, keyof SourceLists> &
  SourceLists;

function jsonExtraData<T extends { extraData: unknown }>(row: T): WithJsonExtraData<T> {
  const extraData: JsonValue =
    row.extraData === null || row.extraData === undefined
      ? null
      : // oxlint-disable-next-line unicorn/prefer-structured-clone -- structuredClone keeps the type unknown; the JSON round trip gives a JSON value
        JSON.parse(JSON.stringify(row.extraData));
  return { ...row, extraData };
}

function withJsonExtraData<
  T extends { sources: CandidateCardResponse[]; candidatePrintings: CandidatePrintingResponse[] },
>(detail: T): Omit<T, keyof SourceLists> & SourceLists {
  return {
    ...detail,
    sources: detail.sources.map((source) => jsonExtraData(source)),
    candidatePrintings: detail.candidatePrintings.map((candidate) => jsonExtraData(candidate)),
  };
}

const fetchAdminCardList = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<CandidateCardSummaryResponse[]> =>
    apiOrpcClient(adminCardQueriesContract, context.cookie).listCandidates(),
  );

export const adminCardListQueryOptions = queryOptions({
  queryKey: adminKeys.cards.list,
  queryFn: () => fetchAdminCardList(),
  staleTime: 5 * MINUTE_MS,
});

const fetchAllCards = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AllCardsResponse> =>
    apiOrpcClient(adminCardQueriesContract, context.cookie).allCards(),
  );

export const allCardsQueryOptions = queryOptions({
  queryKey: adminKeys.cards.allCards,
  queryFn: () => fetchAllCards(),
  staleTime: 5 * MINUTE_MS,
});

const fetchErrataAnnouncements = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<ErrataAnnouncement[]> =>
    apiOrpcClient(adminCardQueriesContract, context.cookie).errataAnnouncements(),
  );

export const errataAnnouncementsQueryOptions = queryOptions({
  queryKey: adminKeys.cards.errataAnnouncements,
  queryFn: () => fetchErrataAnnouncements(),
  staleTime: 5 * MINUTE_MS,
});

const fetchAdminCardDetail = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(async ({ context, data: cardSlug }): Promise<AdminCardDetail> => {
    const detail = await apiOrpcClient(adminCardQueriesContract, context.cookie).getCandidateCard({
      cardSlug,
    });
    return withJsonExtraData(detail);
  });

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
    staleTime: 5 * MINUTE_MS,
    refetchInterval: (query) =>
      hasPendingRehost(query.state.data) ? REHOST_POLL_INTERVAL_MS : false,
  });
}

const fetchUnmatchedCardDetail = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(async ({ context, data: name }): Promise<UnmatchedCardDetail> => {
    const detail = await apiOrpcClient(adminCardQueriesContract, context.cookie).getUnmatchedDetail(
      { name },
    );
    return withJsonExtraData(detail);
  });

export function unmatchedCardDetailQueryOptions(name: string) {
  return queryOptions({
    queryKey: adminKeys.cards.unmatched(name),
    queryFn: () => fetchUnmatchedCardDetail({ data: name }),
  });
}
