import { useQuery } from "@tanstack/react-query";

import type { JobRunsQueryParams } from "@/features/admin/lib/job-runs-queries";
import { adminJobRunsQueryOptions } from "@/features/admin/lib/job-runs-queries";

export function useAdminJobRuns(params: JobRunsQueryParams) {
  return useQuery(adminJobRunsQueryOptions(params));
}
