import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { listsQueryOptions } from "@/features/lists/hooks/use-lists";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/_authenticated/extension/cardmarket")({
  // data-only: the page states when the counts were prepared on the viewer's own clock.
  ssr: "data-only",
  head: () =>
    seoHead({ siteUrl: getSiteUrl(), title: "Wishlist counts on Cardmarket", noIndex: true }),
  loader: async ({ context }) => {
    await context.queryClient.query({
      ...listsQueryOptions(context.userId, "wish"),
      staleTime: "static",
    });
  },
  errorComponent: RouteErrorFallback,
});
