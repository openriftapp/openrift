import type { QueryClient } from "@tanstack/react-query";

import { adminAccessQueryOptions } from "@/features/admin/lib/admin-queries";
import { hasAdminSection } from "@/features/admin/lib/admin-sections";
import { adminDistributionChannelsQueryOptions } from "@/features/admin/lib/distribution-channels-queries";
import { adminLanguagesQueryOptions } from "@/features/admin/lib/languages-queries";
import { adminMarkersQueryOptions } from "@/features/admin/lib/markers-queries";
import { providerSettingsQueryOptions } from "@/features/admin/lib/provider-settings-queries";
import { adminDistinctArtistsQueryOptions } from "@/features/cards/lib/distinct-artists-queries";
import { setsQueryOptions } from "@/features/cards/lib/sets-queries";
import { initQueryOptions } from "@/lib/init-queries";

/**
 * Loads in parallel the reference data a face or printing record reads through suspense queries.
 * Provider settings are card-review only, so a desk user's load does not wait on them.
 */
export function loadRecordReferenceData(queryClient: QueryClient): Promise<unknown[]> {
  void Promise.allSettled([
    queryClient.query({ ...providerSettingsQueryOptions, staleTime: "static" }),
  ]);
  return loadDeskRecordReferenceData(queryClient);
}

export function loadDeskRecordReferenceData(queryClient: QueryClient): Promise<unknown[]> {
  return Promise.all([
    queryClient.query({ ...initQueryOptions, staleTime: "static" }),
    queryClient.query({ ...adminMarkersQueryOptions, staleTime: "static" }),
    queryClient.query({ ...adminDistributionChannelsQueryOptions, staleTime: "static" }),
  ]);
}

async function loadReviewProviderSettings(
  queryClient: QueryClient,
  userId: string,
): Promise<unknown> {
  const access = await queryClient.query({
    ...adminAccessQueryOptions(userId),
    staleTime: "static",
  });
  if (!hasAdminSection(access, "card-review")) {
    return undefined;
  }
  return queryClient.query({ ...providerSettingsQueryOptions, staleTime: "static" });
}

/**
 * Loads in parallel what `useCardDetailData` reads through chained suspense queries.
 * Provider settings load only for card-review holders, the only users who can read them.
 */
export function loadCardDetailData(queryClient: QueryClient, userId: string): Promise<unknown[]> {
  return Promise.all([
    queryClient.query({ ...initQueryOptions, staleTime: "static" }),
    loadReviewProviderSettings(queryClient, userId),
    queryClient.query({ ...adminMarkersQueryOptions, staleTime: "static" }),
    queryClient.query({ ...adminDistributionChannelsQueryOptions, staleTime: "static" }),
    queryClient.query({ ...adminLanguagesQueryOptions, staleTime: "static" }),
    queryClient.query({ ...adminDistinctArtistsQueryOptions, staleTime: "static" }),
  ]);
}

/** Loads in parallel what the creation panel reads through suspense queries. */
export function loadCreationReferenceData(queryClient: QueryClient): Promise<unknown[]> {
  return Promise.all([
    queryClient.query({ ...initQueryOptions, staleTime: "static" }),
    queryClient.query({ ...setsQueryOptions, staleTime: "static" }),
    queryClient.query({ ...adminDistinctArtistsQueryOptions, staleTime: "static" }),
    queryClient.query({ ...adminDistributionChannelsQueryOptions, staleTime: "static" }),
  ]);
}
