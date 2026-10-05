import { adminImagesContract } from "@openrift/shared/contracts/admin/images";
import type {
  BrokenImagesResponse,
  LowResImagesResponse,
  MissingImageCard,
  RegenerateImagesKickoffResponse,
  RehostImageResponse,
  RehostStatusResponse,
  UnrehostImagesResponse,
} from "@openrift/shared/types/api/admin";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchRehostStatusFn = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<RehostStatusResponse> =>
    apiOrpcClient(adminImagesContract, context.cookie).rehostStatus(),
  );

const fetchBrokenImagesFn = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<BrokenImagesResponse> =>
    apiOrpcClient(adminImagesContract, context.cookie).brokenImages(),
  );

const fetchLowResImagesFn = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<LowResImagesResponse> =>
    apiOrpcClient(adminImagesContract, context.cookie).lowResImages(),
  );

const fetchMissingImagesFn = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<MissingImageCard[]> =>
    apiOrpcClient(adminImagesContract, context.cookie).missingImages(),
  );

const rehostImagesBatchFn = createServerFn({ method: "POST" })
  .middleware([withCookies])
  .handler(({ context }): Promise<RehostImageResponse> =>
    apiOrpcClient(adminImagesContract, context.cookie).rehost({ query: {} }),
  );

const regenerateImagesKickoffFn = createServerFn({ method: "POST" })
  .validator((input: { skipExisting?: boolean; reset?: boolean; scansOnly?: boolean }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<RegenerateImagesKickoffResponse> => {
    const query: { skipExisting?: "true"; reset?: "true"; scansOnly?: "true" } = {};
    if (data.skipExisting) {
      query.skipExisting = "true";
    }
    if (data.reset) {
      query.reset = "true";
    }
    if (data.scansOnly) {
      query.scansOnly = "true";
    }
    return apiOrpcClient(adminImagesContract, context.cookie).regenerate({ query });
  });

const cancelRegenerateImagesFn = createServerFn({ method: "POST" })
  .middleware([withCookies])
  .handler(({ context }): Promise<{ runId: string; cancelRequested: true }> =>
    apiOrpcClient(adminImagesContract, context.cookie).cancelRegenerate(),
  );

const unrehostImagesFn = createServerFn({ method: "POST" })
  .validator((input: { imageIds: string[] }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<UnrehostImagesResponse> =>
    apiOrpcClient(adminImagesContract, context.cookie).unrehost({ imageIds: data.imageIds }),
  );

const clearRehostedFn = createServerFn({ method: "POST" })
  .middleware([withCookies])
  .handler(async ({ context }) => {
    await apiOrpcClient(adminImagesContract, context.cookie).clearRehosted();
  });

const cleanupOrphanedFn = createServerFn({ method: "POST" })
  .middleware([withCookies])
  .handler(({ context }): Promise<{ scanned: number; deleted: number; errors: string[] }> =>
    apiOrpcClient(adminImagesContract, context.cookie).cleanupOrphaned(),
  );

const migrateDirectoriesFn = createServerFn({ method: "POST" })
  .middleware([withCookies])
  .handler(
    ({
      context,
    }): Promise<{
      scanned: number;
      moved: number;
      skipped: number;
      failed: number;
      errors: string[];
    }> => apiOrpcClient(adminImagesContract, context.cookie).migrateDirectories(),
  );

export function useRehostStatus() {
  return useQuery({
    queryKey: adminKeys.rehostStatus,
    queryFn: () => fetchRehostStatusFn(),
  });
}

export function useBrokenImages(enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.brokenImages,
    queryFn: () => fetchBrokenImagesFn(),
    enabled,
  });
}

export function useLowResImages(enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.lowResImages,
    queryFn: () => fetchLowResImagesFn(),
    enabled,
  });
}

export function useMissingImages() {
  return useQuery({
    queryKey: adminKeys.missingImages,
    queryFn: () => fetchMissingImagesFn(),
  });
}

const REGENERATE_INVALIDATES = [
  adminKeys.jobRunsByKind("images.regenerate"),
  adminKeys.jobRuns,
] as const;

export function useRehostImages(onBatchComplete?: () => void) {
  return useMutationWithInvalidation({
    mutationFn: async (): Promise<RehostImageResponse> => {
      const totals: RehostImageResponse = {
        total: 0,
        rehosted: 0,
        skipped: 0,
        failed: 0,
        errors: [],
      };
      while (true) {
        const batch = await rehostImagesBatchFn();
        totals.total += batch.total;
        totals.rehosted += batch.rehosted;
        totals.skipped += batch.skipped;
        totals.failed += batch.failed;
        totals.errors.push(...batch.errors);
        onBatchComplete?.();
        if (batch.total === 0 || batch.rehosted === 0) {
          break;
        }
      }
      return totals;
    },
    invalidates: [adminKeys.rehostStatus],
  });
}

export function useUnrehostImages() {
  return useMutationWithInvalidation({
    mutationFn: (imageIds: string[]) => unrehostImagesFn({ data: { imageIds } }),
    invalidates: [adminKeys.rehostStatus, adminKeys.brokenImages],
  });
}

/** The server auto-resumes from the most recent failed run unless `reset: true` is passed. */
export function useRegenerateImages() {
  return useMutationWithInvalidation({
    mutationFn: (input: { skipExisting?: boolean; reset?: boolean; scansOnly?: boolean } = {}) =>
      regenerateImagesKickoffFn({ data: input }),
    invalidates: REGENERATE_INVALIDATES,
  });
}

export function useCancelRegenerateImages() {
  return useMutationWithInvalidation({
    mutationFn: () => cancelRegenerateImagesFn(),
    invalidates: REGENERATE_INVALIDATES,
  });
}

export function useClearRehosted() {
  return useMutationWithInvalidation({
    mutationFn: () => clearRehostedFn(),
    invalidates: [adminKeys.rehostStatus],
  });
}

export function useCleanupOrphaned() {
  return useMutationWithInvalidation({
    mutationFn: () => cleanupOrphanedFn(),
    invalidates: [adminKeys.rehostStatus],
  });
}

export function useMigrateDirectories() {
  return useMutationWithInvalidation({
    mutationFn: () => migrateDirectoriesFn(),
    invalidates: [adminKeys.rehostStatus],
  });
}
