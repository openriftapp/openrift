import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { metaSubmissionsQueryOptions } from "@/features/meta/lib/meta-submissions-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/meta_/submissions")({
  ssr: "data-only",
  head: () => privateSeoHead("Decklists you sent"),
  loader: async ({ context }) => {
    await context.queryClient.infiniteQuery({
      ...metaSubmissionsQueryOptions(context.userId),
      staleTime: "static",
    });
  },
  errorComponent: RouteErrorFallback,
});
