import { cardsContract } from "@openrift/shared/contracts/cards";
import type { CardDetailResponse } from "@openrift/shared/types/api/catalog";
import { isDefinedError, safe } from "@orpc/client";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { enrichCardDetail } from "@/features/cards/hooks/use-card-detail";
import { catalogAdminKeys } from "@/features/catalog-admin/lib/catalog-admin-query-keys";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchPublicCardPreview = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .handler(async ({ data: cardSlug }): Promise<CardDetailResponse | null> => {
    const { error, data } = await safe(apiOrpcClient(cardsContract).detail({ cardSlug }));
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        return null;
      }
      throw error;
    }
    return data;
  });

export function usePublicCardPreview(cardSlug: string) {
  return useQuery(
    queryOptions({
      queryKey: catalogAdminKeys.publicPreview(cardSlug),
      queryFn: () => fetchPublicCardPreview({ data: cardSlug }),
      staleTime: 0,
      select: (response: CardDetailResponse | null) =>
        response === null ? null : enrichCardDetail(response),
    }),
  );
}
