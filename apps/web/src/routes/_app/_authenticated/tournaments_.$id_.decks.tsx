import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { canOpenDeckCheck } from "@/features/tournaments/lib/tournament-display";
import {
  loadTournamentDetail,
  redirectToTournamentOverview,
} from "@/features/tournaments/lib/tournament-route-guards";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/tournaments_/$id_/decks")({
  ssr: "data-only",
  head: () => privateSeoHead("Deck check"),
  loader: async ({ context, params }) => {
    const detail = await loadTournamentDetail(context.queryClient, context.userId, params.id);
    if (!canOpenDeckCheck(detail)) {
      redirectToTournamentOverview(params.id);
    }
  },
  errorComponent: RouteErrorFallback,
});
