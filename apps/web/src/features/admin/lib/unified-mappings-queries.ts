import { adminUnifiedMappingsContract } from "@openrift/shared/contracts/admin/unified-mappings";
import type { UnifiedMappingsSummaryResponse } from "@openrift/shared/contracts/admin/unified-mappings";
import type {
  UnifiedMappingsCardResponse,
  UnifiedMappingsResponse,
} from "@openrift/shared/types/api/admin";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchUnifiedMappings = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<UnifiedMappingsResponse> =>
    apiOrpcClient(adminUnifiedMappingsContract, context.cookie).list(),
  );

export function unifiedMappingsQueryOptions() {
  return queryOptions({
    queryKey: adminKeys.unifiedMappings.list,
    queryFn: () => fetchUnifiedMappings(),
  });
}

const fetchUnifiedMappingsSummary = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<UnifiedMappingsSummaryResponse> =>
    apiOrpcClient(adminUnifiedMappingsContract, context.cookie).summary(),
  );

export function unifiedMappingsSummaryQueryOptions() {
  return queryOptions({
    queryKey: adminKeys.unifiedMappings.summary,
    queryFn: () => fetchUnifiedMappingsSummary(),
  });
}

const fetchUnifiedMappingsForCard = createServerFn({ method: "GET" })
  .validator((input: { cardSlug: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<UnifiedMappingsCardResponse> =>
    apiOrpcClient(adminUnifiedMappingsContract, context.cookie).card({ cardSlug: data.cardSlug }),
  );

export function unifiedMappingsForCardQueryOptions(cardSlug: string) {
  return queryOptions({
    queryKey: adminKeys.unifiedMappings.byCard(cardSlug),
    queryFn: () => fetchUnifiedMappingsForCard({ data: { cardSlug } }),
  });
}
