import { listsContract } from "@openrift/shared/contracts/lists";
import type { ListGroupSharesResponse } from "@openrift/shared/types/api/friend-group";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { listsKeys } from "@/features/lists/lib/lists-query-keys";
import { useRequiredUserId } from "@/hooks/use-session";
import { orNotFound } from "@/lib/server-fns/api-error";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchShares = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: listId }): Promise<ListGroupSharesResponse> =>
    orNotFound(apiOrpcClient(listsContract, context.cookie).groupShares({ id: listId })),
  );

export function listGroupSharesQueryOptions(userId: string, listId: string) {
  return queryOptions({
    queryKey: listsKeys.groupShares(userId, listId),
    queryFn: () => fetchShares({ data: listId }),
  });
}

export function useListGroupShares(listId: string) {
  const userId = useRequiredUserId();
  return useSuspenseQuery(listGroupSharesQueryOptions(userId, listId));
}
