import { legendDisplayName } from "@openrift/shared/card-name";
import type { QueryClient } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";

import { cardDetailQueryOptions } from "@/features/cards/lib/card-detail-queries";
import { notFoundOnSentinel } from "@/lib/server-fns/api-error";

export async function loadContributeCardName(
  queryClient: QueryClient,
  cardSlug: string,
  printingId?: string,
): Promise<{ cardName: string }> {
  const data = await notFoundOnSentinel(
    queryClient.query({ ...cardDetailQueryOptions(cardSlug), staleTime: "static" }),
  );
  if (
    printingId !== undefined &&
    !data.printings.some((printing) => printing.printingId === printingId)
  ) {
    throw notFound();
  }
  return { cardName: legendDisplayName(data.card) };
}
