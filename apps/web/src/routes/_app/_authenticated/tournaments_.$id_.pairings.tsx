import { createFileRoute } from "@tanstack/react-router";

import {
  loadTournamentDetail,
  loadTournamentRunState,
  redirectToTournamentOverview,
} from "@/features/tournaments/lib/tournament-route-guards";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/tournaments_/$id_/pairings")({
  ssr: "data-only",
  head: () => privateSeoHead("Pairings"),
  loader: async ({ context, params }) => {
    const detail = await loadTournamentDetail(context.queryClient, context.userId, params.id);
    if (detail.pairingStyle === "none") {
      redirectToTournamentOverview(params.id);
    }
    await loadTournamentRunState(context.queryClient, context.userId, params.id);
  },
});
