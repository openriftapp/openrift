import { createFileRoute, Link } from "@tanstack/react-router";

import { LinkGoneState } from "@/components/link-gone-state";
import { buttonVariants } from "@/components/ui/button";
import { boardStateQueryOptions } from "@/features/board-states/lib/board-states-queries";
import { ruleVersionsQueryOptions } from "@/features/rules/lib/rules-queries";
import { requireFeature } from "@/lib/feature-flags";
import { privateSeoHead } from "@/lib/seo";
import { notFoundOnSentinel } from "@/lib/server-fns/api-error";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/_app/_authenticated/board-states_/$boardStateId")({
  ssr: "data-only",
  head: () => privateSeoHead("Board state"),
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "board-states"),
  loader: async ({ context, params }) => {
    await notFoundOnSentinel(
      Promise.all([
        context.queryClient.query({
          ...boardStateQueryOptions(context.userId, params.boardStateId),
          staleTime: "static",
        }),
        context.queryClient.query({ ...ruleVersionsQueryOptions("core"), staleTime: "static" }),
        context.queryClient.query({
          ...ruleVersionsQueryOptions("tournament"),
          staleTime: "static",
        }),
      ]),
    );
  },
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
