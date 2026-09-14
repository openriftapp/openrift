import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { isTournamentStaff } from "@/features/tournaments/lib/tournament-display";
import {
  loadTournamentDetail,
  redirectToTournamentOverview,
} from "@/features/tournaments/lib/tournament-route-guards";
import { tournamentParticipantsQueryOptions } from "@/features/tournaments/lib/tournaments-queries";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/_authenticated/tournaments_/$id_/participants")({
  ssr: "data-only",
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "Participants", noIndex: true }),
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
