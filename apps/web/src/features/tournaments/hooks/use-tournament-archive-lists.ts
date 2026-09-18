import { tournamentArchiveListsContract } from "@openrift/shared/contracts/tournament-archive-lists";
import type {
  ArchiveListRefreshResponse,
  ArchiveListSendResponse,
  ArchiveListStateResponse,
  UvsgamesEventSuggestion,
} from "@openrift/shared/types/api/tournament";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import type { ArchiveListLink } from "@/features/tournaments/lib/archive-lists";
import { tournamentsKeys } from "@/features/tournaments/lib/tournaments-query-keys";
import { useRequiredUserId } from "@/lib/auth-session";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";
import { useMutationWithInvalidation } from "@/lib/use-mutation-with-invalidation";

const fetchState = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: id }): Promise<ArchiveListStateResponse> =>
    apiOrpcClient(tournamentArchiveListsContract, context.cookie).state({ id }),
  );

const refreshFn = createServerFn({ method: "POST" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: id }): Promise<ArchiveListRefreshResponse> =>
    apiOrpcClient(tournamentArchiveListsContract, context.cookie).refresh({ id }),
  );

const sendFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; links: ArchiveListLink[] }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<ArchiveListSendResponse> =>
    apiOrpcClient(tournamentArchiveListsContract, context.cookie).send(data),
  );

const fetchSuggestions = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(async ({ context, data: id }): Promise<UvsgamesEventSuggestion[]> => {
    const response = await apiOrpcClient(
      tournamentArchiveListsContract,
      context.cookie,
    ).uvsgamesSuggestions({ id });
    return response.items;
  });

export function useTournamentArchiveLists(tournamentId: string) {
  const userId = useRequiredUserId();
  return useQuery({
    queryKey: tournamentsKeys.archiveLists(userId, tournamentId),
    queryFn: () => fetchState({ data: tournamentId }),
  });
}

export function useRefreshTournamentArchiveLists(tournamentId: string) {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => refreshFn({ data: tournamentId }),
    onSuccess: (response) => {
      queryClient.setQueryData(tournamentsKeys.archiveLists(userId, tournamentId), response.state);
    },
  });
}

export function useSendTournamentArchiveLists(tournamentId: string) {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation({
    mutationFn: (links: ArchiveListLink[]) => sendFn({ data: { id: tournamentId, links } }),
    invalidates: () => [
      tournamentsKeys.archiveLists(userId, tournamentId),
      tournamentsKeys.detail(userId, tournamentId),
    ],
  });
}

export function useUvsgamesSuggestions(tournamentId: string, enabled: boolean) {
  const userId = useRequiredUserId();
  return useQuery({
    queryKey: tournamentsKeys.uvsgamesSuggestions(userId, tournamentId),
    queryFn: () => fetchSuggestions({ data: tournamentId }),
    enabled,
  });
}
