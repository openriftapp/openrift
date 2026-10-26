import type {
  WorkspaceDecisionsInput,
  WorkspaceEvent,
  WorkspaceEventsResponse,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import { adminCatalogWorkspaceContract } from "@openrift/shared/contracts/admin/catalog-workspace";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { historySentence } from "@/features/admin/lib/history-events";
import type { WorkspaceTarget } from "@/features/catalog-workspace/lib/owner-items";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchWorkspaceDecisions = createServerFn({ method: "GET" })
  .validator((input: WorkspaceDecisionsInput) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<WorkspaceEventsResponse> =>
    apiOrpcClient(adminCatalogWorkspaceContract, context.cookie).workspaceDecisions(data),
  );

function workspaceDecisionsQueryOptions(since?: string) {
  return queryOptions({
    queryKey: [...adminKeys.workspace, "decisions", since ?? "today"] as const,
    queryFn: () => fetchWorkspaceDecisions({ data: { since } }),
    staleTime: 60 * 1000,
  });
}

export function useWorkspaceDecisions(options?: { since?: string; enabled?: boolean }) {
  return useQuery({
    ...workspaceDecisionsQueryOptions(options?.since),
    enabled: options?.enabled ?? true,
    select: (data) => newestFirst(data.events),
  });
}

export function newestFirst(events: readonly WorkspaceEvent[]): WorkspaceEvent[] {
  return events.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function decisionSentence(event: WorkspaceEvent): string {
  return historySentence({
    id: event.id,
    actorUserId: "",
    actorName: null,
    actorEmail: null,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    entityLabel: null,
    cardSlug: event.cardSlug,
    oldValues: null,
    newValues: null,
    createdAt: event.createdAt,
  });
}

export function decisionTarget(event: WorkspaceEvent): WorkspaceTarget | null {
  if (event.entityType === "printing" && event.entityId !== null) {
    return { kind: "printing", printingId: event.entityId };
  }
  if (event.entityType === "face" && event.entityId !== null && event.cardSlug !== null) {
    return { kind: "face", cardSlug: event.cardSlug, faceId: event.entityId };
  }
  if (event.cardSlug !== null) {
    return { kind: "card", cardSlug: event.cardSlug };
  }
  return null;
}
