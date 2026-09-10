import type { CardmarketOverlaySnapshot } from "@openrift/shared/contracts/cardmarket-overlay";
import { cardmarketOverlayContract } from "@openrift/shared/contracts/cardmarket-overlay";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { extensionKeys } from "@/features/extension/lib/extension-query-keys";
import { useRequiredUserId } from "@/lib/auth-session";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";
import { useDisplayStore } from "@/stores/display-store";

interface SnapshotInput {
  listIds: string[];
  marketplace: Marketplace;
}

const fetchCardmarketOverlaySnapshot = createServerFn({ method: "POST" })
  .validator((input: SnapshotInput) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<CardmarketOverlaySnapshot> =>
    apiOrpcClient(cardmarketOverlayContract, context.cookie).snapshot(data),
  );

function cardmarketOverlayQueryOptions(
  userId: string,
  marketplace: Marketplace,
  sortedListIds: readonly string[],
) {
  return queryOptions({
    queryKey: extensionKeys.cardmarketOverlay(userId, marketplace, sortedListIds),
    queryFn: () =>
      fetchCardmarketOverlaySnapshot({ data: { listIds: [...sortedListIds], marketplace } }),
  });
}

export function useCardmarketOverlaySnapshot(listIds: readonly string[]) {
  const userId = useRequiredUserId();
  const marketplace = useDisplayStore((state) => state.marketplaceOrder[0]);
  const sorted = listIds.toSorted();
  return useQuery({
    ...cardmarketOverlayQueryOptions(userId, marketplace, sorted),
    enabled: sorted.length > 0,
  });
}
