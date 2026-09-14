import { adminAuditEventsContract } from "@openrift/shared/contracts/admin/audit-events";
import { infiniteQueryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import type { AdminAuditEventsListResponse } from "@/lib/server-fns/api-types";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

export interface AuditFilters {
  actorUserId?: string;
  action?: string;
  search?: string;
}

const fetchAuditEventsFn = createServerFn({ method: "GET" })
  .validator(
    (input: { cursor?: string; actorUserId?: string; action?: string; search?: string }) => input,
  )
  .middleware([withCookies])
  .handler(
    ({ context, data }): Promise<AdminAuditEventsListResponse> =>
      // The contract types payloads as Record<string, unknown>; the response
      // interface narrows them to the serializable AuditPayloadValue shape.
      apiOrpcClient(adminAuditEventsContract, context.cookie).list({
        cursor: data.cursor,
        actorUserId: data.actorUserId || undefined,
        action: data.action || undefined,
        search: data.search || undefined,
      }) as Promise<AdminAuditEventsListResponse>,
  );

export function auditEventsQueryOptions(filters: AuditFilters = {}) {
  return infiniteQueryOptions({
    queryKey: ["admin", "audit-events", filters] as const,
    queryFn: ({ pageParam }) =>
      fetchAuditEventsFn({
        data: {
          cursor: pageParam || undefined,
          actorUserId: filters.actorUserId,
          action: filters.action,
          search: filters.search,
        },
      }),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
