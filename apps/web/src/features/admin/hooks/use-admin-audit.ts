import { adminAuditEventsContract } from "@openrift/shared/contracts/admin/audit-events";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import type { AuditFilters } from "@/features/admin/lib/admin-audit-queries";
import { auditEventsQueryOptions } from "@/features/admin/lib/admin-audit-queries";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type {
  AdminAuditActionsResponse,
  AdminAuditActorsResponse,
} from "@/lib/server-fns/api-types";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchAuditActorsFn = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminAuditActorsResponse> =>
    apiOrpcClient(adminAuditEventsContract, context.cookie).actors(),
  );

const fetchAuditActionsFn = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminAuditActionsResponse> =>
    apiOrpcClient(adminAuditEventsContract, context.cookie).actions(),
  );

export function useAuditEvents(filters: AuditFilters) {
  return useInfiniteQuery(auditEventsQueryOptions(filters));
}

export function useAuditActors() {
  return useQuery({
    queryKey: adminKeys.audit.actors,
    queryFn: () => fetchAuditActorsFn(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAuditActions() {
  return useQuery({
    queryKey: adminKeys.audit.actions,
    queryFn: () => fetchAuditActionsFn(),
    staleTime: 5 * 60 * 1000,
  });
}
