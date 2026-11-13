import { boardShareDescription } from "@openrift/shared/share-titles";
import type { PublicBoardStateDetailResponse } from "@openrift/shared/types/api/board-state";
import { createFileRoute, Link } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { LinkGoneState } from "@/components/link-gone-state";
import { buttonVariants } from "@/components/ui/button";
import { publicBoardStateQueryOptions } from "@/features/board-states/lib/board-states-queries";
import { requireFeature } from "@/lib/feature-flags";
import { privateSeoHead, seoHead } from "@/lib/seo";
import { notFoundOnSentinel } from "@/lib/server-fns/api-error";
import { boardStateShareImageUrl, shareImageVersion } from "@/lib/share-image";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

interface BoardStateHeadData {
  boardState: Pick<PublicBoardStateDetailResponse["boardState"], "title" | "summary" | "updatedAt">;
  owner: Pick<PublicBoardStateDetailResponse["owner"], "displayName">;
}

export const Route = createFileRoute("/_app/board/$token")({
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "board-states"),
  // Returns only what head reads: loader data is dehydrated beside the query
  // cache, and returning the whole response would ship it twice.
  loader: async ({ context, params }): Promise<BoardStateHeadData> => {
    const data = await notFoundOnSentinel(
      context.queryClient.query({
        ...publicBoardStateQueryOptions(params.token),
        staleTime: "static",
      }),
    );
    const { title, summary, updatedAt } = data.boardState;
    return {
      boardState: { title, summary, updatedAt },
      owner: { displayName: data.owner.displayName },
    };
  },
  head: ({ loaderData, params }) => {
    const siteUrl = getSiteUrl();
    const path = `/board/${params.token}`;
    const data = loaderData as BoardStateHeadData | undefined;
    if (!data) {
      return privateSeoHead("Board state");
    }
    return seoHead({
      siteUrl,
      title: data.boardState.title,
      description: data.boardState.summary ?? boardShareDescription(data.owner.displayName),
      path,
      ogImage: boardStateShareImageUrl(
        siteUrl,
        params.token,
        shareImageVersion(data.boardState.updatedAt),
      ),
      unlisted: true,
    });
  },
  errorComponent: RouteErrorFallback,
  notFoundComponent: () => (
    <LinkGoneState
      title={m.board_states_share_gone_title()}
      description={m.board_states_share_gone_description()}
      action={
        <Link to="/rules" className={buttonVariants()}>
          {m.board_states_share_gone_action()}
        </Link>
      }
      width="capped"
    />
  ),
});
