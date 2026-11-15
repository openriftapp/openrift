import { createFileRoute } from "@tanstack/react-router";

import { NotFoundFallback } from "@/components/error-message";
import { tournamentClaimLandingQueryOptions } from "@/features/tournaments/lib/tournaments-queries";
import { privateSeoHead } from "@/lib/seo";
import { notFoundOnSentinel } from "@/lib/server-fns/api-error";
import { m } from "@/paraglide/messages.js";

// Outside `_authenticated` on purpose: the confirm step is reachable logged-out
// so a claim link renders "Claim your spot in <tournament>?" before routing through login.
export const Route = createFileRoute("/_app/tournaments_/claim/$token")({
  ssr: "data-only",
  loader: async ({ context, params }) => {
    const landing = await notFoundOnSentinel(
      context.queryClient.query({
        ...tournamentClaimLandingQueryOptions(params.token),
        staleTime: "static",
      }),
    );
    return { claimsDeck: landing.deckSubmission !== "none" };
  },
  head: ({ loaderData }) =>
    privateSeoHead(
      loaderData?.claimsDeck
        ? m.tournaments_claim_page_title({}, { locale: "en" })
        : m.tournaments_claim_page_title_spot({}, { locale: "en" }),
    ),
  notFoundComponent: NotFoundFallback,
});
