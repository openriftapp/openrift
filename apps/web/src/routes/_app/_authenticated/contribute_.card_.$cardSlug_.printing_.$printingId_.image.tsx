import { legendDisplayName } from "@openrift/shared/card-name";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod/mini";

import { NotFoundFallback, RouteErrorFallback } from "@/components/error-message";
import { cardDetailQueryOptions } from "@/features/cards/lib/card-detail-queries";
import { sideSearchParam } from "@/lib/route-search";
import { privateSeoHead } from "@/lib/seo";
import { notFoundOnSentinel } from "@/lib/server-fns/api-error";

interface ContributeCardHeadData {
  cardName: string;
}

export const Route = createFileRoute(
  "/_app/_authenticated/contribute_/card_/$cardSlug_/printing_/$printingId_/image",
)({
  validateSearch: z.object({ side: sideSearchParam }),
  head: ({ loaderData }) => {
    const data = loaderData as ContributeCardHeadData | undefined;
    return privateSeoHead(data ? `Suggest an image for ${data.cardName}` : "Suggest an image");
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
