import { adminCatalogWorkspaceBulkContract } from "@openrift/shared/contracts/admin/catalog-workspace-bulk";
import type {
  WorkspaceDiscardSameDifferenceResponse,
  WorkspaceSameDifferenceInput,
  WorkspaceSameDifferenceResponse,
} from "@openrift/shared/contracts/admin/catalog-workspace-bulk";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchSameDifference = createServerFn({ method: "GET" })
  .validator((input: WorkspaceSameDifferenceInput) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<WorkspaceSameDifferenceResponse> =>
    apiOrpcClient(adminCatalogWorkspaceBulkContract, context.cookie).workspaceSameDifference(data),
  );

export const discardSameDifferenceFn = createServerFn({ method: "POST" })
  .validator((input: WorkspaceSameDifferenceInput) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<WorkspaceDiscardSameDifferenceResponse> =>
    apiOrpcClient(adminCatalogWorkspaceBulkContract, context.cookie).workspaceDiscardSameDifference(
      data,
    ),
  );

export function sameDifferenceQueryOptions(input: WorkspaceSameDifferenceInput) {
  return queryOptions({
    queryKey: adminKeys.workspaceSameDifference(input),
    queryFn: () => fetchSameDifference({ data: input }),
    staleTime: 60 * 1000,
  });
}
