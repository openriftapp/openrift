import { legendDisplayName } from "@openrift/shared/card-name";
import { createFileRoute } from "@tanstack/react-router";

import { NotFoundFallback, RouteErrorFallback } from "@/components/error-message";
import { cardDetailQueryOptions } from "@/features/cards/lib/card-detail-queries";
import { privateSeoHead } from "@/lib/seo";
import { notFoundOnSentinel } from "@/lib/server-fns/api-error";

interface ContributeCardHeadData {
  cardName: string;
}

export const Route = createFileRoute("/_app/_authenticated/contribute_/card_/$cardSlug_/printing")({
  head: ({ loaderData }) => {
    const data = loaderData as ContributeCardHeadData | undefined;
    return privateSeoHead(data ? `Add a printing of ${data.cardName}` : "Add a printing");
  },
  loader: async ({ context, params }): Promise<ContributeCardHeadData> => {
    const data = await notFoundOnSentinel(
      context.queryClient.query({
        ...cardDetailQueryOptions(params.cardSlug),
        staleTime: "static",
      }),
    );
    return { cardName: legendDisplayName(data.card) };
  },
  component: () => null,
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundFallback,
});
