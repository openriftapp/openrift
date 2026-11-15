import { createFileRoute } from "@tanstack/react-router";

import { NotFoundFallback } from "@/components/error-message";
import { loadContributeCardName } from "@/features/contribute/lib/contribute-card-head";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/contribute_/card_/$cardSlug")({
  loader: ({ context, params }) => loadContributeCardName(context.queryClient, params.cardSlug),
  head: ({ loaderData }) =>
    privateSeoHead(
      loaderData ? `Suggest a correction to ${loaderData.cardName}` : "Suggest a correction",
    ),
  component: () => null,
  notFoundComponent: NotFoundFallback,
});
