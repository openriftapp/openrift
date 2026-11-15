import { createFileRoute } from "@tanstack/react-router";

import { canManageTournament } from "@/features/tournaments/lib/tournament-display";
import {
  loadTournamentDetail,
  redirectToTournamentOverview,
} from "@/features/tournaments/lib/tournament-route-guards";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/tournaments_/$id_/staff")({
  ssr: "data-only",
  head: () => privateSeoHead("Staff"),
  loader: async ({ context, params }) => {
    const detail = await loadTournamentDetail(context.queryClient, context.userId, params.id);
    if (!canManageTournament(detail.myRoles)) {
      redirectToTournamentOverview(params.id);
    }
  },
});
