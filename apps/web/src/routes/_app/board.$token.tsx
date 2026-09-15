import type { PublicBoardStateDetailResponse } from "@openrift/shared/types/api/board-state";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Link2OffIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { RouteErrorFallback } from "@/components/error-message";
import { buttonVariants } from "@/components/ui/button";
import { requireBoardStatesFlag } from "@/features/rules/lib/board-states-flag";
import { publicBoardStateQueryOptions } from "@/features/rules/lib/board-states-queries";
import { seoHead } from "@/lib/seo";
import { boardStateShareImageUrl, shareImageVersion } from "@/lib/share-image";
import { getSiteUrl } from "@/lib/site-config";
import { cn, PAGE_PADDING, PAGE_WIDTH } from "@/lib/utils";
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
        data.boardState.answer ?? `A Riftbound board state by ${data.owner.displayName}.`,
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
      if (error instanceof Error && error.message === "NOT_FOUND") {
        throw notFound();
      }
      throw error;
    }
  },
  errorComponent: RouteErrorFallback,
  notFoundComponent: SharedBoardStateNotFound,
});

function SharedBoardStateNotFound() {
  return (
    <div className={cn(PAGE_PADDING, PAGE_WIDTH.capped)}>
      <EmptyState
        className="py-16"
        icon={Link2OffIcon}
        title={m.board_states_share_gone_title()}
        description={m.board_states_share_gone_description()}
      >
        <Link to="/rules" className={buttonVariants()}>
          {m.board_states_share_gone_action()}
        </Link>
      </EmptyState>
    </div>
  );
}
