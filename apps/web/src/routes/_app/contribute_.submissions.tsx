import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { cardSubmissionsQueryOptions } from "@/features/contribute/lib/card-submissions-queries";
import { requireSession } from "@/lib/auth-session";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/contribute_/submissions")({
  ssr: "data-only",
  beforeLoad: ({ location, context }) => requireSession({ context, location }),
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "My card submissions", noIndex: true }),
  loader: async ({ context }) => {
    await context.queryClient.infiniteQuery({
      ...cardSubmissionsQueryOptions(context.userId),
      staleTime: "static",
    });
  },
  errorComponent: RouteErrorFallback,
});
