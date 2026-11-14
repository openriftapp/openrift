import { createFileRoute } from "@tanstack/react-router";

import { NotFoundFallback, RouteErrorFallback } from "@/components/error-message";
import { loadContributeCardName } from "@/features/contribute/lib/contribute-card-head";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/contribute_/card_/$cardSlug_/printing")({
  loader: ({ context, params }) => loadContributeCardName(context.queryClient, params.cardSlug),
  head: ({ loaderData }) =>
    privateSeoHead(loaderData ? `Add a printing of ${loaderData.cardName}` : "Add a printing"),
  component: () => null,
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundFallback,
});
