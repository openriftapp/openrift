import { useQuery } from "@tanstack/react-query";

import { latestJobRunQueryOptions } from "@/features/admin/lib/job-runs-queries";

export function useLatestJobRun(kind: string) {
  return useQuery(latestJobRunQueryOptions(kind));
}
