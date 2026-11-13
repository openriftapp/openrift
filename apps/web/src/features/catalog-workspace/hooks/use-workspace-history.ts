import type {
  WorkspaceEventsResponse,
  WorkspaceHistoryInput,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import { adminCatalogWorkspaceContract } from "@openrift/shared/contracts/admin/catalog-workspace";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import {
  historySummary,
  newestFirst,
} from "@/features/catalog-workspace/lib/card-record-summaries";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

export type WorkspaceHistoryTarget = { printingId: string } | { faceId: string };

const fetchWorkspaceHistory = createServerFn({ method: "GET" })
  .validator((input: WorkspaceHistoryInput) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<WorkspaceEventsResponse> =>
    apiOrpcClient(adminCatalogWorkspaceContract, context.cookie).workspaceHistory(data),
  );

export function workspaceHistoryQueryOptions(target: WorkspaceHistoryTarget) {
  return queryOptions({
    queryKey: adminKeys.workspaceHistory(target),
    queryFn: () => fetchWorkspaceHistory({ data: target }),
    staleTime: 60 * 1000,
  });
}

export function useWorkspaceHistory(target: WorkspaceHistoryTarget, enabled = true) {
  const query = useQuery({ ...workspaceHistoryQueryOptions(target), enabled });
  const events = newestFirst(query.data?.events ?? []);
  return {
    isPending: query.isPending,
    isError: query.isError,
    events,
    summary: historySummary(events),
  };
}
