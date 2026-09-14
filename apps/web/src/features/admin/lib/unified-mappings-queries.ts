import { adminUnifiedMappingsContract } from "@openrift/shared/contracts/admin/unified-mappings";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type {
  UnifiedMappingsCardResponse,
  UnifiedMappingsResponse,
} from "@/lib/server-fns/api-types";
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

const fetchUnifiedMappingsForCard = createServerFn({ method: "GET" })
  .validator((input: { cardId: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<UnifiedMappingsCardResponse> =>
    apiOrpcClient(adminUnifiedMappingsContract, context.cookie).card({ cardId: data.cardId }),
  );

export function unifiedMappingsForCardQueryOptions(cardId: string) {
  return queryOptions({
    queryKey: adminKeys.unifiedMappings.byCard(cardId),
    queryFn: () => fetchUnifiedMappingsForCard({ data: { cardId } }),
  });
}
