import { tournamentPlayriftboundContract } from "@openrift/shared/contracts/tournament-playriftbound";
import type {
  PlayriftboundSyncResponse,
  PlayriftboundSyncTargetsResponse,
} from "@openrift/shared/types/api/tournament";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { tournamentsKeys } from "@/features/tournaments/lib/tournaments-query-keys";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useRequiredUserId } from "@/hooks/use-session";
import { withCookies } from "@/lib/server-fns/middleware";
import type { ContractInput } from "@/lib/server-fns/orpc-client";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

type SyncInput = ContractInput<typeof tournamentPlayriftboundContract, "sync">;

const fetchTargets = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: eventId }): Promise<PlayriftboundSyncTargetsResponse> =>
    apiOrpcClient(tournamentPlayriftboundContract, context.cookie).targets({ eventId }),
  );

const syncFn = createServerFn({ method: "POST" })
  .validator((input: SyncInput) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<PlayriftboundSyncResponse> =>
    apiOrpcClient(tournamentPlayriftboundContract, context.cookie).sync(data),
  );

export function usePlayriftboundTargets(eventId: string | undefined) {
  const userId = useRequiredUserId();
  return useQuery({
    queryKey: tournamentsKeys.playriftboundTargets(userId, eventId ?? ""),
    queryFn: () => fetchTargets({ data: eventId ?? "" }),
    enabled: eventId !== undefined,
  });
}

export function useSyncPlayriftbound() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation<PlayriftboundSyncResponse, SyncInput>({
    mutationFn: (data) => syncFn({ data }),
    meta: { inlineError: true },
    invalidates: () => [tournamentsKeys.all(userId)],
  });
}
