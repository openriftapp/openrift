import { createFileRoute } from "@tanstack/react-router";

import { NotFoundFallback, RouteErrorFallback } from "@/components/error-message";
import { tournamentSubmitLandingQueryOptions } from "@/features/tournaments/lib/tournaments-queries";
import { privateSeoHead } from "@/lib/seo";
import { notFoundOnSentinel } from "@/lib/server-fns/api-error";

// Outside `_authenticated` on purpose: the landing API is public, so a signed-out
// invitee sees the tournament and its host before signing in.
export const Route = createFileRoute("/_app/tournaments_/submit/$token")({
  ssr: "data-only",
  head: () => privateSeoHead("Join tournament"),
  loader: async ({ context, params }) => {
    await notFoundOnSentinel(
      context.queryClient.query({
        ...tournamentSubmitLandingQueryOptions(params.token),
        staleTime: "static",
      }),
    );
  },
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundFallback,
});
