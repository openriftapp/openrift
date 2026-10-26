import type {
  WorkspaceEvent,
  WorkspaceEventsResponse,
  WorkspaceHistoryInput,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import { adminCatalogWorkspaceContract } from "@openrift/shared/contracts/admin/catalog-workspace";
import { formatRelativeTime } from "@openrift/shared/format-date";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
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
    queryKey: [...adminKeys.workspace, "history", target] as const,
    queryFn: () => fetchWorkspaceHistory({ data: target }),
    staleTime: 60 * 1000,
  });
}

export function newestFirst(events: readonly WorkspaceEvent[]): WorkspaceEvent[] {
  return events.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function historySummary(events: readonly WorkspaceEvent[], now?: Date): string | undefined {
  const newest = newestFirst(events).at(0);
  return newest === undefined
    ? undefined
    : `${newest.label} ${formatRelativeTime(newest.createdAt, { now })}`;
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
