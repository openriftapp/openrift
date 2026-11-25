import type { AdminAuditEventResponse } from "@openrift/shared/contracts/admin/audit-events";
import type { WorkspaceHistoryInput } from "@openrift/shared/contracts/admin/catalog-workspace";
import { adminCatalogWorkspaceContract } from "@openrift/shared/contracts/admin/catalog-workspace";
import { MINUTE_MS } from "@openrift/shared/format-date";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { historySentence } from "@/features/admin/lib/history-events";
import {
  historySummary,
  newestFirst,
} from "@/features/catalog-workspace/lib/card-record-summaries";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

export type WorkspaceHistoryTarget = { printingId: string } | { faceId: string };

export type WorkspaceHistoryEvent = AdminAuditEventResponse & { label: string };

const fetchWorkspaceHistory = createServerFn({ method: "GET" })
  .validator((input: WorkspaceHistoryInput) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }): Promise<{ events: WorkspaceHistoryEvent[] }> => {
    const response = await apiOrpcClient(
      adminCatalogWorkspaceContract,
      context.cookie,
    ).workspaceHistory(data);
    // Audit payloads are plain JSON by construction; the wire schema types them as unknown.
    return response as { events: WorkspaceHistoryEvent[] };
  });

export function workspaceHistoryQueryOptions(target: WorkspaceHistoryTarget) {
  return queryOptions({
    queryKey: adminKeys.workspaceHistory(target),
    queryFn: () => fetchWorkspaceHistory({ data: target }),
    staleTime: MINUTE_MS,
  });
}

export function useWorkspaceHistory(target: WorkspaceHistoryTarget, enabled = true) {
  const query = useQuery({ ...workspaceHistoryQueryOptions(target), enabled });
  const events = newestFirst(query.data?.events ?? []);
  return {
    isPending: query.isPending,
    isError: query.isError,
    events,
    summary: historySummary(
      events.map((event) => ({ createdAt: event.createdAt, label: historySentence(event) })),
    ),
  };
}
