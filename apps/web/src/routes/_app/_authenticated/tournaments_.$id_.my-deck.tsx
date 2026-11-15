import { createFileRoute } from "@tanstack/react-router";

import {
  loadTournamentDetail,
  redirectToTournamentOverview,
} from "@/features/tournaments/lib/tournament-route-guards";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/tournaments_/$id_/my-deck")({
  ssr: "data-only",
  head: () => privateSeoHead("My deck"),
  loader: async ({ context, params }) => {
    const detail = await loadTournamentDetail(context.queryClient, context.userId, params.id);
    // No staff role check: holding an entry is the whole gate, so a judge
    // without a deck of their own is redirected too.
    if (!detail.myDeckEntry) {
      redirectToTournamentOverview(params.id);
    }
  },
});
