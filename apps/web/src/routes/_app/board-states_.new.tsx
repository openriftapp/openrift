import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { requireBoardStatesFlag } from "@/features/rules/lib/board-states-flag";
import { ruleVersionsQueryOptions } from "@/features/rules/lib/rules-queries";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/board-states_/new")({
  ssr: "data-only",
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "New board state", noIndex: true }),
  beforeLoad: async ({ context }) => {
    await requireBoardStatesFlag(context.queryClient);
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.query(ruleVersionsQueryOptions("core")),
      context.queryClient.query(ruleVersionsQueryOptions("tournament")),
    ]);
  },
  errorComponent: RouteErrorFallback,
});
