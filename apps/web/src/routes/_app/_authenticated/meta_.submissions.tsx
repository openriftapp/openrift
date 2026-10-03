import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { metaSubmissionsQueryOptions } from "@/features/meta/lib/meta-submissions-queries";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/_authenticated/meta_/submissions")({
  ssr: "data-only",
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "Decklists you sent", noIndex: true }),
  loader: async ({ context }) => {
    await context.queryClient.infiniteQuery({
      ...metaSubmissionsQueryOptions(context.userId),
      staleTime: "static",
    });
  },
  errorComponent: RouteErrorFallback,
});
