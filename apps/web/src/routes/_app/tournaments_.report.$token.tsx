import { createFileRoute } from "@tanstack/react-router";

import { NotFoundFallback } from "@/components/error-message";
import { tournamentReportQueryOptions } from "@/features/tournaments/lib/tournament-run-queries";
import { privateSeoHead } from "@/lib/seo";
import { notFoundOnSentinel } from "@/lib/server-fns/api-error";

export const Route = createFileRoute("/_app/tournaments_/report/$token")({
  head: () => privateSeoHead("Tournament"),
  loader: async ({ context, params }) => {
    await notFoundOnSentinel(
      context.queryClient.query({
        ...tournamentReportQueryOptions(params.token),
        staleTime: "static",
      }),
    );
  },
  notFoundComponent: NotFoundFallback,
});
