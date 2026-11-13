import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { privateSeoHead } from "@/lib/seo";

// Outside `_authenticated` on purpose: the confirm step is reachable logged-out
// so a claim link renders "Claim your spot in <tournament>?" before routing through login.
export const Route = createFileRoute("/_app/tournaments_/claim/$token")({
  ssr: "data-only",
  head: () => privateSeoHead("Claim your spot"),
  errorComponent: RouteErrorFallback,
});
