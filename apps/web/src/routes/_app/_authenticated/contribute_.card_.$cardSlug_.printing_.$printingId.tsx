import { legendDisplayName } from "@openrift/shared/card-name";
import { createFileRoute, notFound } from "@tanstack/react-router";

import { NotFoundFallback, RouteErrorFallback } from "@/components/error-message";
import { cardDetailQueryOptions } from "@/features/cards/lib/card-detail-queries";
import { privateSeoHead } from "@/lib/seo";
import { notFoundOnSentinel } from "@/lib/server-fns/api-error";

interface ContributeCardHeadData {
  cardName: string;
}

export const Route = createFileRoute(
  "/_app/_authenticated/contribute_/card_/$cardSlug_/printing_/$printingId",
)({
  head: ({ loaderData }) => {
    const data = loaderData as ContributeCardHeadData | undefined;
    return privateSeoHead(
      data
        ? `Suggest a correction to a printing of ${data.cardName}`
        : "Suggest a printing correction",
    );
  },
  loader: async ({ context, params }): Promise<ContributeCardHeadData> => {
    const data = await notFoundOnSentinel(
      context.queryClient.query({
        ...cardDetailQueryOptions(params.cardSlug),
        staleTime: "static",
      }),
    );
    if (!data.printings.some((p) => p.printingId === params.printingId)) {
      throw notFound();
    }
    return { cardName: legendDisplayName(data.card) };
  },
  component: () => null,
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundFallback,
});
