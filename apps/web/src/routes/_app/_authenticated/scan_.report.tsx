import { createFileRoute } from "@tanstack/react-router";

import { NotFoundFallback, RouteErrorFallback } from "@/components/error-message";
import { requireFeature } from "@/lib/feature-flags";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/scan_/report")({
  // data-only: the journal it reports on lives in this device's localStorage.
  ssr: "data-only",
  head: () => privateSeoHead("Scan report"),
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "scanner"),
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundFallback,
});
