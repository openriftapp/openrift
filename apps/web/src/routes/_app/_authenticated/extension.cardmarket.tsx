import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { listsQueryOptions } from "@/features/lists/lib/lists-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/extension/cardmarket")({
  // data-only: the page states when the counts were prepared on the viewer's own clock.
  ssr: "data-only",
  head: () => privateSeoHead("Wishlist counts on Cardmarket"),
  loader: async ({ context }) => {
    await context.queryClient.query({
      ...listsQueryOptions(context.userId, "wish"),
      staleTime: "static",
    });
  },
  errorComponent: RouteErrorFallback,
});
