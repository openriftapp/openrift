import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { isTournamentStaff } from "@/features/tournaments/lib/tournament-display";
import { loadTournamentDetail } from "@/features/tournaments/lib/tournament-route-guards";
import { tournamentParticipantsQueryOptions } from "@/features/tournaments/lib/tournaments-queries";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/_authenticated/tournaments_/$id")({
  ssr: "data-only",
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "Tournament", noIndex: true }),
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
  errorComponent: RouteErrorFallback,
});
