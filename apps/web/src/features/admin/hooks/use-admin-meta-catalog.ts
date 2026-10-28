import type {
  MetaArchiveJobs,
  MetaCancellableJob,
  MetaSource,
  MetaSourceFormat,
  MetaSourceTemplate,
  MetaSyncCancelResult,
  MetaSyncSettings,
  MetaSyncStatus,
  MetaSyncTriggerResult,
} from "@openrift/shared/contracts/admin/meta-catalog";
import { adminMetaCatalogContract } from "@openrift/shared/contracts/admin/meta-catalog";
import type { MetaEventTier } from "@openrift/shared/types/enums";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { MetaSyncTrigger } from "@/features/admin/lib/meta-admin-triggers";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchMetaSourceTemplates = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }) =>
    apiOrpcClient(adminMetaCatalogContract, context.cookie).listTemplates(),
  );

/** Every event template the source publishes, plus any the mirror still carries. */
export function useMetaSourceTemplates() {
  return useQuery({
    queryKey: adminKeys.meta.sourceTemplates,
    queryFn: () => fetchMetaSourceTemplates(),
  });
}

export interface MetaSourceTemplateInput {
  templateId: string;
  watched?: boolean;
  tier?: MetaEventTier | null;
}

const updateMetaSourceTemplateFn = createServerFn({ method: "POST" })
  .validator((input: MetaSourceTemplateInput) => input)
  .middleware([withCookies])
  .handler(({ context, data }) =>
    apiOrpcClient(adminMetaCatalogContract, context.cookie).updateTemplate(data),
  );

/** A tier mapping only writes here; the events it maps move when the retier pass runs. */
const vocabularyInvalidates = [
  adminKeys.meta.sourceTemplates,
  adminKeys.meta.sourceFormats,
  adminKeys.meta.mirror,
  adminKeys.meta.syncStatus.prefix,
] as const;

export function useUpdateMetaSourceTemplate() {
  return useMutationWithInvalidation<MetaSourceTemplate, MetaSourceTemplateInput>({
    mutationFn: (vars) => updateMetaSourceTemplateFn({ data: vars }),
    invalidates: vocabularyInvalidates,
  });
}

const fetchMetaSourceFormats = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }) => apiOrpcClient(adminMetaCatalogContract, context.cookie).listFormats());

export function useMetaSourceFormats() {
  return useQuery({
    queryKey: adminKeys.meta.sourceFormats,
    queryFn: () => fetchMetaSourceFormats(),
  });
}

/** Null unmaps the format, which bars it from auto-accept. */
export interface MetaSourceFormatInput {
  sourceFormat: string;
  mappedFormat: string | null;
}

const updateMetaSourceFormatFn = createServerFn({ method: "POST" })
  .validator((input: MetaSourceFormatInput) => input)
  .middleware([withCookies])
  .handler(({ context, data }) =>
    apiOrpcClient(adminMetaCatalogContract, context.cookie).updateFormat(data),
  );

export function useUpdateMetaSourceFormat() {
  return useMutationWithInvalidation<MetaSourceFormat, MetaSourceFormatInput>({
    mutationFn: (vars) => updateMetaSourceFormatFn({ data: vars }),
    invalidates: vocabularyInvalidates,
  });
}

const fetchMetaSyncSettings = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<MetaSyncSettings> =>
    apiOrpcClient(adminMetaCatalogContract, context.cookie).settings(),
  );

export function useMetaSyncSettings() {
  return useQuery({
    queryKey: adminKeys.meta.syncSettings,
    queryFn: () => fetchMetaSyncSettings(),
    staleTime: 5 * 60 * 1000,
  });
}

/** Fields left out keep their stored value. */
export interface MetaSyncSettingsInput {
  autoAcceptMinPlayers?: number | null;
  autoAcceptNotable?: boolean;
  autoAcceptOfficial?: boolean;
  competitivePlayerFloor?: number;
}

const updateMetaSyncSettingsFn = createServerFn({ method: "POST" })
  .validator((input: MetaSyncSettingsInput) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<MetaSyncSettings> =>
    apiOrpcClient(adminMetaCatalogContract, context.cookie).updateSettings(data),
  );

export function useUpdateMetaSyncSettings() {
  return useMutationWithInvalidation<MetaSyncSettings, MetaSyncSettingsInput>({
    mutationFn: (vars) => updateMetaSyncSettingsFn({ data: vars }),
    invalidates: [adminKeys.meta.syncSettings],
  });
}

const rejectPassingNoResultsFn = createServerFn({ method: "POST" })
  .validator((input: { source: MetaSource }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<{ rejected: number }> =>
    apiOrpcClient(adminMetaCatalogContract, context.cookie).rejectPassingNoResults(data),
  );

export function useRejectPassingNoResults(source: MetaSource) {
  return useMutationWithInvalidation<{ rejected: number }, void>({
    mutationFn: () => rejectPassingNoResultsFn({ data: { source } }),
    invalidates: [adminKeys.meta.syncStatus.prefix, adminKeys.meta.mirror],
  });
}

const fetchMetaSyncStatus = createServerFn({ method: "GET" })
  .validator((input: { source: MetaSource }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<MetaSyncStatus> =>
    apiOrpcClient(adminMetaCatalogContract, context.cookie).syncStatus({ source: data.source }),
  );

export const SYNC_STATUS_POLL_MS = 15_000;

export function useMetaSyncStatus(source: MetaSource) {
  return useQuery({
    queryKey: adminKeys.meta.syncStatus(source),
    queryFn: () => fetchMetaSyncStatus({ data: { source } }),
    refetchInterval: SYNC_STATUS_POLL_MS,
  });
}

const fetchMetaArchiveJobsFn = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<MetaArchiveJobs> =>
    apiOrpcClient(adminMetaCatalogContract, context.cookie).archiveJobs(),
  );

export function useMetaArchiveJobs() {
  return useQuery({
    queryKey: adminKeys.meta.archiveJobs,
    queryFn: () => fetchMetaArchiveJobsFn(),
    refetchInterval: SYNC_STATUS_POLL_MS,
  });
}

const runMetaSyncFn = createServerFn({ method: "POST" })
  .validator((input: { trigger: MetaSyncTrigger }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<MetaSyncTriggerResult> => {
    const client = apiOrpcClient(adminMetaCatalogContract, context.cookie);
    return client[data.trigger]();
  });

const syncRunInvalidates = [
  adminKeys.meta.syncStatus.prefix,
  adminKeys.meta.archiveJobs,
  adminKeys.meta.mirror,
  adminKeys.jobRuns,
] as const;

/** The result says `running`; the crawl itself finishes in the background. */
export function useRunMetaSync() {
  return useMutationWithInvalidation<MetaSyncTriggerResult, { trigger: MetaSyncTrigger }>({
    mutationFn: (vars) => runMetaSyncFn({ data: vars }),
    invalidates: syncRunInvalidates,
  });
}

const cancelRunFn = createServerFn({ method: "POST" })
  .validator((input: { source: MetaSource; job: MetaCancellableJob }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<MetaSyncCancelResult> =>
    apiOrpcClient(adminMetaCatalogContract, context.cookie).cancelRun({
      source: data.source,
      job: data.job,
    }),
  );

/** Stops at the job's next checkpoint, not immediately; the panel keeps polling to see it land. */
export function useCancelMetaRun(source: MetaSource) {
  return useMutationWithInvalidation<MetaSyncCancelResult, { job: MetaCancellableJob }>({
    mutationFn: (vars) => cancelRunFn({ data: { source, job: vars.job } }),
    invalidates: syncRunInvalidates,
  });
}
