import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { isTournamentStaff } from "@/features/tournaments/lib/tournament-display";
import {
  loadTournamentDetail,
  redirectToTournamentOverview,
} from "@/features/tournaments/lib/tournament-route-guards";
import { tournamentParticipantsQueryOptions } from "@/features/tournaments/lib/tournaments-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/tournaments_/$id_/participants")({
  ssr: "data-only",
  head: () => privateSeoHead("Participants"),
  loader: async ({ context, params }) => {
    // The roster's API endpoint is staff-only; a plain participant lands on
    // the overview.
    const detail = await loadTournamentDetail(context.queryClient, context.userId, params.id);
    if (!isTournamentStaff(detail.myRoles)) {
      redirectToTournamentOverview(params.id);
    }
    await context.queryClient.query({
      ...tournamentParticipantsQueryOptions(context.userId, params.id),
      staleTime: "static",
    });
  },
  errorComponent: RouteErrorFallback,
});
