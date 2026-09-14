import type { JobSchedulesListResponse } from "@openrift/shared/contracts/admin/job-schedules";
import { adminJobSchedulesContract } from "@openrift/shared/contracts/admin/job-schedules";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchJobSchedules = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<JobSchedulesListResponse> =>
    apiOrpcClient(adminJobSchedulesContract, context.cookie).list(),
  );

const JOB_SCHEDULES_REFRESH_INTERVAL_MS = 60_000;

export const adminJobSchedulesQueryOptions = queryOptions({
  queryKey: adminKeys.jobSchedules,
  queryFn: () => fetchJobSchedules(),
  refetchInterval: JOB_SCHEDULES_REFRESH_INTERVAL_MS,
});
