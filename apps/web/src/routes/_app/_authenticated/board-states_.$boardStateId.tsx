import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { LinkGoneState } from "@/components/link-gone-state";
import { buttonVariants } from "@/components/ui/button";
import { requireBoardStatesFlag } from "@/features/board-states/lib/board-states-flag";
import { boardStateQueryOptions } from "@/features/board-states/lib/board-states-queries";
import { ruleVersionsQueryOptions } from "@/features/rules/lib/rules-queries";
import { seoHead } from "@/lib/seo";
import { isNotFoundSentinel } from "@/lib/server-fns/api-error";
import { getSiteUrl } from "@/lib/site-config";
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
      if (isNotFoundSentinel(error)) {
        throw notFound();
      }
      throw error;
    }
  },
  errorComponent: RouteErrorFallback,
  notFoundComponent: () => (
    <LinkGoneState
      title={m.board_states_not_found_title()}
      description={m.board_states_not_found_description()}
      action={
        <Link to="/board-states" className={buttonVariants()}>
          {m.board_states_not_found_action()}
        </Link>
      }
      width="capped"
    />
  ),
});
