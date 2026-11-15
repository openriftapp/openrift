import { createFileRoute } from "@tanstack/react-router";

import { NotFoundFallback } from "@/components/error-message";
import { tournamentStaffInviteLandingQueryOptions } from "@/features/tournaments/lib/tournaments-queries";
import { privateSeoHead } from "@/lib/seo";
import { notFoundOnSentinel } from "@/lib/server-fns/api-error";

// Outside `_authenticated` on purpose: the landing API is public, so a signed-out
// invitee can read the invite before creating an account. Accepting still needs a session.
export const Route = createFileRoute("/_app/tournaments_/staff-invite/$token")({
  ssr: "data-only",
  head: () => privateSeoHead("Staff invite"),
  loader: async ({ context, params }) => {
    await notFoundOnSentinel(
      context.queryClient.query({
        ...tournamentStaffInviteLandingQueryOptions(params.token),
        staleTime: "static",
      }),
    );
  },
  notFoundComponent: NotFoundFallback,
});
