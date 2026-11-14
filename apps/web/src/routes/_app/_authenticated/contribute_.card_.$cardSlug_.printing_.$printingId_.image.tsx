import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/mini";

import { NotFoundFallback, RouteErrorFallback } from "@/components/error-message";
import { loadContributeCardName } from "@/features/contribute/lib/contribute-card-head";
import { sideSearchParam } from "@/lib/route-search";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute(
  "/_app/_authenticated/contribute_/card_/$cardSlug_/printing_/$printingId_/image",
)({
  validateSearch: z.object({ side: sideSearchParam }),
  loader: ({ context, params }) =>
    loadContributeCardName(context.queryClient, params.cardSlug, params.printingId),
  head: ({ loaderData }) =>
    privateSeoHead(loaderData ? `Suggest an image for ${loaderData.cardName}` : "Suggest an image"),
  component: () => null,
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundFallback,
});
