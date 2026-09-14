import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import {
  adminCardDetailQueryOptions,
  adminCardListQueryOptions,
  allCardsQueryOptions,
  unmatchedCardDetailQueryOptions,
} from "@/features/admin/lib/admin-card-queries";

export function useAdminCardList() {
  return useSuspenseQuery(adminCardListQueryOptions);
}

/** Non-suspending variant so a caller can skip fetching the whole list when unused. */
export function useAdminCardListWhen(enabled: boolean) {
  return useQuery({ ...adminCardListQueryOptions, enabled });
}

export function useNextUncheckedCard(currentSlug: string, allowedSlugs?: Set<string> | null) {
  const queryClient = useQueryClient();

  async function fetchNext(): Promise<string | null> {
    const rows = await queryClient.query(adminCardListQueryOptions);
    const next = rows.find(
      (r: {
        cardSlug: string | null;
        uncheckedCardCount: number;
        uncheckedPrintingCount: number;
      }) =>
        r.cardSlug &&
        r.cardSlug !== currentSlug &&
        r.uncheckedCardCount + r.uncheckedPrintingCount > 0 &&
        (!allowedSlugs || allowedSlugs.has(r.cardSlug)),
    );
    return next?.cardSlug ?? null;
  }

  return { fetchNext };
}

export function useAllCards() {
  return useSuspenseQuery(allCardsQueryOptions);
}

export function useAdminCardDetail(cardSlug: string) {
  return useQuery({
    ...adminCardDetailQueryOptions(cardSlug),
    enabled: Boolean(cardSlug),
  });
}

export function useUnmatchedCardDetail(name: string) {
  return useQuery({
    ...unmatchedCardDetailQueryOptions(name),
    enabled: Boolean(name),
  });
}
