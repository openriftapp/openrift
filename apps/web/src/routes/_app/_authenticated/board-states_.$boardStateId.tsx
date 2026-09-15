import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Link2OffIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { RouteErrorFallback } from "@/components/error-message";
import { buttonVariants } from "@/components/ui/button";
import { requireBoardStatesFlag } from "@/features/rules/lib/board-states-flag";
import { boardStateQueryOptions } from "@/features/rules/lib/board-states-queries";
import { ruleVersionsQueryOptions } from "@/features/rules/lib/rules-queries";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";
import { cn, PAGE_PADDING, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/_app/_authenticated/board-states_/$boardStateId")({
  ssr: "data-only",
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "Board state", noIndex: true }),
  beforeLoad: async ({ context }) => {
    await requireBoardStatesFlag(context.queryClient);
  },
  loader: async ({ context, params }) => {
    try {
      await Promise.all([
        context.queryClient.query({
          ...boardStateQueryOptions(context.userId, params.boardStateId),
          staleTime: "static",
        }),
        context.queryClient.query(ruleVersionsQueryOptions("core")),
        context.queryClient.query(ruleVersionsQueryOptions("tournament")),
      ]);
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") {
        throw notFound();
      }
      throw error;
    }
  },
  errorComponent: RouteErrorFallback,
  notFoundComponent: BoardStateNotFound,
});

function BoardStateNotFound() {
  return (
    <div className={cn(PAGE_PADDING, PAGE_WIDTH.capped)}>
      <EmptyState
        className="py-16"
        icon={Link2OffIcon}
        title={m.board_states_not_found_title()}
        description={m.board_states_not_found_description()}
      >
        <Link to="/board-states" className={buttonVariants()}>
          {m.board_states_not_found_action()}
        </Link>
      </EmptyState>
    </div>
  );
}
