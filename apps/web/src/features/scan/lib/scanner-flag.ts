import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";

import type { FeatureFlags } from "@/lib/feature-flags";
import { featureEnabled, featureFlagsQueryOptions } from "@/lib/feature-flags";

export async function requireScanner(queryClient: QueryClient): Promise<void> {
  const flags = (await queryClient.query({
    ...featureFlagsQueryOptions,
    staleTime: "static",
  })) as FeatureFlags;
  if (!featureEnabled(flags, "scanner")) {
    throw redirect({ to: "/collections" });
  }
}
