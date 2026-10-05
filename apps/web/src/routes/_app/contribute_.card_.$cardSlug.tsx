import { createFileRoute } from "@tanstack/react-router";

import { NotFoundFallback, RouteErrorFallback } from "@/components/error-message";
import { cardDetailQueryOptions } from "@/features/cards/lib/card-detail-queries";
import { requireSession } from "@/lib/auth-session";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/contribute_/card_/$cardSlug")({
  beforeLoad: async ({ location, context }) => {
    await requireSession({ context, location });
  },
  head: ({ params }) =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: `Suggest correction for ${params.cardSlug}`,
      description: "Suggest a correction to a Riftbound card on OpenRift.",
      path: `/contribute/card/${params.cardSlug}`,
    }),
  loader: ({ context, params }) =>
    context.queryClient.query({ ...cardDetailQueryOptions(params.cardSlug), staleTime: "static" }),
  component: () => null,
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundFallback,
});
