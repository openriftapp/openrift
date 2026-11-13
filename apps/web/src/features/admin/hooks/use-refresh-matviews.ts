import { adminOperationsContract } from "@openrift/shared/contracts/admin/operations";
import type { JobRunStartedResponse } from "@openrift/shared/types/api/admin";
import { useMutation } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const refreshMatviewsFn = createServerFn({ method: "POST" })
  .middleware([withCookies])
  .handler(({ context }): Promise<JobRunStartedResponse> =>
    apiOrpcClient(adminOperationsContract, context.cookie).refreshMatviews(),
  );

/**
 * The refresh can exceed the API's request timeout; the endpoint answers 202
 * with a run handle to poll via job-runs (`JOB_KIND.refreshMatviews`).
 */
export function useRefreshMatviews() {
  return useMutation({
    mutationFn: (): Promise<JobRunStartedResponse> => refreshMatviewsFn(),
  });
}
