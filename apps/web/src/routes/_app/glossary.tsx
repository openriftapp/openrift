import { createFileRoute } from "@tanstack/react-router";

import { NotFoundFallback, RouteErrorFallback } from "@/components/error-message";
import { publicSetListQueryOptions } from "@/features/cards/lib/public-sets-queries";
import { querySearchSchema } from "@/features/rules/lib/rules-search-schema";
import { requireFeature } from "@/lib/feature-flags";
import { initQueryOptions } from "@/lib/init-queries";
import { privateSeoHead, seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

interface GlossaryLoaderData {
  served: true;
}

export const Route = createFileRoute("/_app/glossary")({
  validateSearch: querySearchSchema,
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "glossary"),
  loader: async ({ context }): Promise<GlossaryLoaderData> => {
    await Promise.all([
      context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...publicSetListQueryOptions, staleTime: "static" }),
    ]);
    return { served: true };
  },
  head: ({ loaderData }) =>
    (loaderData as GlossaryLoaderData | undefined)?.served
      ? seoHead({
          siteUrl: getSiteUrl(),
          title: "Glossary",
          description:
            "Riftbound symbols, keywords, and shorthand. Each keyword links into the official rules.",
          path: "/glossary",
        })
      : privateSeoHead("Glossary"),
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundFallback,
});
