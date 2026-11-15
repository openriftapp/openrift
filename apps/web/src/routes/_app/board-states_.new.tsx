import { createFileRoute } from "@tanstack/react-router";

import { NotFoundFallback } from "@/components/error-message";
import { ruleVersionsQueryOptions } from "@/features/rules/lib/rules-queries";
import { requireFeature } from "@/lib/feature-flags";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/board-states_/new")({
  ssr: "data-only",
  head: () => privateSeoHead("New board state"),
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "board-states"),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.query({ ...ruleVersionsQueryOptions("core"), staleTime: "static" }),
      context.queryClient.query({ ...ruleVersionsQueryOptions("tournament"), staleTime: "static" }),
    ]);
  },
  notFoundComponent: NotFoundFallback,
});
