import type { CardmarketOverlaySnapshot } from "@openrift/shared/contracts/cardmarket-overlay";
import { cardmarketOverlayContract } from "@openrift/shared/contracts/cardmarket-overlay";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { extensionKeys } from "@/features/extension/lib/extension-query-keys";
import { useRequiredUserId } from "@/lib/auth-session";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

interface SnapshotInput {
  listIds: string[];
}

const fetchCardmarketOverlaySnapshot = createServerFn({ method: "POST" })
  .validator((input: SnapshotInput) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<CardmarketOverlaySnapshot> =>
    apiOrpcClient(cardmarketOverlayContract, context.cookie).snapshot(data),
  );

function cardmarketOverlayQueryOptions(userId: string, sortedListIds: readonly string[]) {
  return queryOptions({
    queryKey: extensionKeys.cardmarketOverlay(userId, sortedListIds),
    queryFn: () => fetchCardmarketOverlaySnapshot({ data: { listIds: [...sortedListIds] } }),
  });
}

export function useCardmarketOverlaySnapshot(listIds: readonly string[]) {
  const userId = useRequiredUserId();
  const sorted = listIds.toSorted();
  return useQuery({
    ...cardmarketOverlayQueryOptions(userId, sorted),
    enabled: sorted.length > 0,
  });
}
