import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { requireBoardStatesFlag } from "@/features/rules/lib/board-states-flag";
import {
  boardStatesQueryOptions,
  featuredBoardStatesQueryOptions,
} from "@/features/rules/lib/board-states-queries";
import { sessionQueryOptions } from "@/lib/auth-session";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/board-states")({
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Board states",
      description: "Riftbound game situations drawn step by step, each tied to one rules version.",
      path: "/board-states",
      noIndex: true,
    }),
  beforeLoad: async ({ context }) => {
    await requireBoardStatesFlag(context.queryClient);
  },
  loader: async ({ context }) => {
    const session = await context.queryClient
      .query({ ...sessionQueryOptions(), staleTime: "static" })
      .catch(() => null);
    await Promise.all([
      context.queryClient.query({ ...featuredBoardStatesQueryOptions(), staleTime: "static" }),
      session?.user
        ? context.queryClient.query({ ...boardStatesQueryOptions(session.user.id) })
        : null,
    ]);
  },
  errorComponent: RouteErrorFallback,
});
