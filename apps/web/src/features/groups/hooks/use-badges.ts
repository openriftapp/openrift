import { badgesContract } from "@openrift/shared/contracts/badges";
import type { BadgesResponse } from "@openrift/shared/types/api/badges";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { badgesKeys } from "@/features/groups/lib/groups-query-keys";
import { useUserId } from "@/lib/auth-session";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchBadges = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<BadgesResponse> =>
    apiOrpcClient(badgesContract, context.cookie).get(),
  );

/**
 * A plain, non-suspense query so this can live in the header outside an
 * authenticated route boundary. The interval only has to cover other people's
 * actions: every trade, loan and group-request mutation invalidates this key.
 */
export function useBadges() {
  const userId = useUserId();
  return useQuery({
    queryKey: badgesKeys.all(userId ?? ""),
    queryFn: () => fetchBadges(),
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
    enabled: userId !== null,
  });
}
