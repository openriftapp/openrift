import type { PublicBoardStateDetailResponse } from "@openrift/shared/types/api/board-state";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { LinkGoneState } from "@/components/link-gone-state";
import { buttonVariants } from "@/components/ui/button";
import { requireBoardStatesFlag } from "@/features/board-states/lib/board-states-flag";
import { publicBoardStateQueryOptions } from "@/features/board-states/lib/board-states-queries";
import { seoHead } from "@/lib/seo";
import { isNotFoundSentinel } from "@/lib/server-fns/api-error";
import { boardStateShareImageUrl, shareImageVersion } from "@/lib/share-image";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/_app/board/$token")({
  head: ({ loaderData, params }) => {
    const siteUrl = getSiteUrl();
    const path = `/board/${params.token}`;
    const data = loaderData as PublicBoardStateDetailResponse | undefined;
    if (!data) {
      return seoHead({ siteUrl, title: "Board state", path, unlisted: true });
    }
    return seoHead({
      siteUrl,
      title: data.boardState.title,
      description:
        data.boardState.summary ?? `A Riftbound board state by ${data.owner.displayName}.`,
      path,
      ogImage: boardStateShareImageUrl(
        siteUrl,
        params.token,
        shareImageVersion(data.boardState.updatedAt),
      ),
      unlisted: true,
    });
  },
  loader: async ({ context, params }): Promise<PublicBoardStateDetailResponse> => {
    await requireBoardStatesFlag(context.queryClient);
    try {
      return await context.queryClient.query({
        ...publicBoardStateQueryOptions(params.token),
        staleTime: "static",
      });
    } catch (error) {
      if (isNotFoundSentinel(error)) {
        throw notFound();
      }
      throw error;
    }
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
