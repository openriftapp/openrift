import type { QueryClient } from "@tanstack/react-query";

import { adminDistributionChannelsQueryOptions } from "@/features/admin/lib/distribution-channels-queries";
import { adminLanguagesQueryOptions } from "@/features/admin/lib/languages-queries";
import { adminMarkersQueryOptions } from "@/features/admin/lib/markers-queries";
import { providerSettingsQueryOptions } from "@/features/admin/lib/provider-settings-queries";
import { adminDistinctArtistsQueryOptions } from "@/features/cards/lib/distinct-artists-queries";
import { initQueryOptions } from "@/lib/init-queries";

/** Loads in parallel what `useCardDetailData` reads through chained suspense queries. */
export function loadCardDetailData(queryClient: QueryClient): Promise<unknown[]> {
  return Promise.all([
    queryClient.query({ ...initQueryOptions, staleTime: "static" }),
    queryClient.query({ ...providerSettingsQueryOptions, staleTime: "static" }),
    queryClient.query({ ...adminMarkersQueryOptions, staleTime: "static" }),
    queryClient.query({ ...adminDistributionChannelsQueryOptions, staleTime: "static" }),
    queryClient.query({ ...adminLanguagesQueryOptions, staleTime: "static" }),
    queryClient.query({ ...adminDistinctArtistsQueryOptions, staleTime: "static" }),
  ]);
}
