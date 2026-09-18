import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { canManageTournament } from "@/features/tournaments/lib/tournament-display";
import {
  loadTournamentDetail,
  redirectToTournamentOverview,
} from "@/features/tournaments/lib/tournament-route-guards";
import type { FeatureFlags } from "@/lib/feature-flags";
import { featureEnabled, featureFlagsQueryOptions } from "@/lib/feature-flags";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/_authenticated/tournaments_/$id_/decks_/archive")({
  ssr: "data-only",
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "Send to Meta Archive", noIndex: true }),
  loader: async ({ context, params }) => {
    const [detail, flags] = await Promise.all([
      loadTournamentDetail(context.queryClient, context.userId, params.id),
      context.queryClient.query({ ...featureFlagsQueryOptions, staleTime: "static" }),
    ]);
    if (
      !featureEnabled(flags as FeatureFlags, "meta") ||
      detail.deckSubmission === "none" ||
      !canManageTournament(detail.myRoles)
    ) {
      redirectToTournamentOverview(params.id);
    }
  },
  errorComponent: RouteErrorFallback,
});
