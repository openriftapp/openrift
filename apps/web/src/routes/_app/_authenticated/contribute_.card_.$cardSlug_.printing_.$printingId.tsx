import { createFileRoute } from "@tanstack/react-router";

import { NotFoundFallback } from "@/components/error-message";
import { loadContributeCardName } from "@/features/contribute/lib/contribute-card-head";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute(
  "/_app/_authenticated/contribute_/card_/$cardSlug_/printing_/$printingId",
)({
  loader: ({ context, params }) =>
    loadContributeCardName(context.queryClient, params.cardSlug, params.printingId),
  head: ({ loaderData }) =>
    privateSeoHead(
      loaderData
        ? `Suggest a correction to a printing of ${loaderData.cardName}`
        : "Suggest a printing correction",
    ),
  component: () => null,
  notFoundComponent: NotFoundFallback,
});
