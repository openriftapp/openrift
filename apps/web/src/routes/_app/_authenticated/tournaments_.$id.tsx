import { createFileRoute } from "@tanstack/react-router";

import { isTournamentStaff } from "@/features/tournaments/lib/tournament-display";
import { loadTournamentDetail } from "@/features/tournaments/lib/tournament-route-guards";
import { tournamentParticipantsQueryOptions } from "@/features/tournaments/lib/tournaments-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/tournaments_/$id")({
  ssr: "data-only",
  head: () => privateSeoHead("Tournament"),
  loader: async ({ context, params }) => {
    // The roster endpoint is staff-gated; prefetching it for a plain
    // participant 403s the whole loader into the error screen.
    const detail = await loadTournamentDetail(context.queryClient, context.userId, params.id);
    if (isTournamentStaff(detail.myRoles)) {
      await context.queryClient.query({
        ...tournamentParticipantsQueryOptions(context.userId, params.id),
        staleTime: "static",
      });
    }
  },
});
