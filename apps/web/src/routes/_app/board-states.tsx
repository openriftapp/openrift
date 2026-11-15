import { createFileRoute } from "@tanstack/react-router";

import { NotFoundFallback } from "@/components/error-message";
import {
  boardStatesQueryOptions,
  featuredBoardStatesQueryOptions,
} from "@/features/board-states/lib/board-states-queries";
import { sessionQueryOptions } from "@/lib/auth-session";
import { requireFeature } from "@/lib/feature-flags";
import { privateSeoHead, seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

interface BoardStatesLoaderData {
  served: true;
}

export const Route = createFileRoute("/_app/board-states")({
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "board-states"),
  loader: async ({ context }): Promise<BoardStatesLoaderData> => {
    const session = await context.queryClient
      .query({ ...sessionQueryOptions(), staleTime: "static" })
      .catch(() => null);
    await Promise.all([
      context.queryClient.query({ ...featuredBoardStatesQueryOptions(), staleTime: "static" }),
      session?.user
        ? context.queryClient.query({
            ...boardStatesQueryOptions(session.user.id),
            staleTime: "static",
          })
        : null,
    ]);
    return { served: true };
  },
  head: ({ loaderData }) =>
    (loaderData as BoardStatesLoaderData | undefined)?.served
      ? seoHead({
          siteUrl: getSiteUrl(),
          title: "Board states",
          description:
            "Riftbound game situations drawn step by step, each tied to one rules version.",
          path: "/board-states",
          noIndex: true,
        })
      : privateSeoHead("Board states"),
  notFoundComponent: NotFoundFallback,
});
