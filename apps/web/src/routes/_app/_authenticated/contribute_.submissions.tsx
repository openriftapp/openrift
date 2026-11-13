import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { cardSubmissionsQueryOptions } from "@/features/contribute/lib/card-submissions-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/contribute_/submissions")({
  ssr: "data-only",
  head: () => privateSeoHead("My card submissions"),
  loader: async ({ context }) => {
    await context.queryClient.infiniteQuery({
      ...cardSubmissionsQueryOptions(context.userId),
      staleTime: "static",
    });
  },
  errorComponent: RouteErrorFallback,
});
