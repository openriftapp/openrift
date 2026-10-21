import { createFileRoute, redirect } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import type { FeatureFlags } from "@/lib/feature-flags";
import { featureEnabled, featureFlagsQueryOptions } from "@/lib/feature-flags";

export const Route = createFileRoute("/_app/_authenticated/admin/workspace")({
  beforeLoad: async ({ context }) => {
    const flags = (await context.queryClient.query({
      ...featureFlagsQueryOptions,
      staleTime: "static",
    })) as FeatureFlags;
    if (!featureEnabled(flags, "catalog-workspace")) {
      throw redirect({ to: "/admin" });
    }
  },
  errorComponent: RouteErrorFallback,
});
