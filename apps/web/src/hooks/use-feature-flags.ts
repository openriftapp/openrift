import { useSuspenseQuery } from "@tanstack/react-query";

import { featureEnabled, featureFlagsQueryOptions } from "@/lib/feature-flags";

export function useFeatureEnabled(key: string): boolean {
  const { data } = useSuspenseQuery(featureFlagsQueryOptions);
  return featureEnabled(data, key);
}
