import { createFileRoute } from "@tanstack/react-router";

import { NotFoundFallback, RouteErrorFallback } from "@/components/error-message";
import { tournamentReportQueryOptions } from "@/features/tournaments/lib/tournament-run-queries";
import { roundSearchSchema } from "@/lib/route-search";
import { privateSeoHead } from "@/lib/seo";
import { notFoundOnSentinel } from "@/lib/server-fns/api-error";

export const Route = createFileRoute("/_app/tournaments_/report/$token_/standings")({
  validateSearch: roundSearchSchema,
  head: () => privateSeoHead("Standings"),
  loader: async ({ context, params }) => {
    await notFoundOnSentinel(
      context.queryClient.query({
        ...tournamentReportQueryOptions(params.token),
        staleTime: "static",
      }),
    );
  },
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundFallback,
});
