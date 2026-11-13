import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import {
  loadTournamentDetail,
  loadTournamentRunState,
  redirectToTournamentOverview,
} from "@/features/tournaments/lib/tournament-route-guards";
import { roundSearchSchema } from "@/lib/route-search";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/tournaments_/$id_/standings")({
  ssr: "data-only",
  validateSearch: roundSearchSchema,
  head: () => privateSeoHead("Standings"),
  loader: async ({ context, params }) => {
    const detail = await loadTournamentDetail(context.queryClient, context.userId, params.id);
    if (detail.pairingStyle === "none") {
      redirectToTournamentOverview(params.id);
    }
    await loadTournamentRunState(context.queryClient, context.userId, params.id);
  },
  errorComponent: RouteErrorFallback,
});
