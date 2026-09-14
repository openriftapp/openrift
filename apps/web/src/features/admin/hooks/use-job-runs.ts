import type { JobRunView } from "@openrift/shared/contracts/admin/job-runs";
import { adminJobRunsContract } from "@openrift/shared/contracts/admin/job-runs";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { JobRunsQueryParams } from "@/features/admin/lib/job-runs-queries";
import { adminJobRunsQueryOptions } from "@/features/admin/lib/job-runs-queries";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

export function useAdminJobRuns(params: JobRunsQueryParams) {
  return useQuery(adminJobRunsQueryOptions(params));
}

const ACTIVE_POLL_MS = 2000;

const fetchLatestJobRunByKind = createServerFn({ method: "GET" })
  .validator((input: { kind: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }): Promise<JobRunView | null> => {
    const res = await apiOrpcClient(adminJobRunsContract, context.cookie).list({
      kind: data.kind,
      limit: 1,
    });
    return res.runs[0] ?? null;
  });

export function useLatestJobRunByKind(kind: string) {
  return useQuery({
    queryKey: adminKeys.jobRunsByKind(kind),
    queryFn: () => fetchLatestJobRunByKind({ data: { kind } }),
    refetchInterval: (query) => (query.state.data?.status === "running" ? ACTIVE_POLL_MS : false),
  });
}
