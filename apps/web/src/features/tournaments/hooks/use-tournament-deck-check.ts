import { tournamentDeckCheckContract } from "@openrift/shared/contracts/tournament-deck-check";
import type {
  DeckCheckEntryDetailResponse,
  DeckCheckEventDetailResponse,
} from "@openrift/shared/types/api/deck-check";
import { isDefinedError, safe } from "@orpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { deckCheckEntryInvalidationKeys } from "@/features/tournaments/lib/tournament-invalidation";
import { tournamentDeckCheckKeys } from "@/features/tournaments/lib/tournaments-query-keys";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useRequiredUserId } from "@/hooks/use-session";
import { reportMutationError } from "@/lib/query-client";
import { orNotFound } from "@/lib/server-fns/api-error";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const POLL_INTERVAL_MS = 5000;

const fetchEntries = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: tournamentId }): Promise<DeckCheckEventDetailResponse> =>
    orNotFound(
      apiOrpcClient(tournamentDeckCheckContract, context.cookie).listEntries({ tournamentId }),
    ),
  );

const fetchEntry = createServerFn({ method: "GET" })
  .validator((input: { tournamentId: string; entryId: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<DeckCheckEntryDetailResponse> =>
    orNotFound(apiOrpcClient(tournamentDeckCheckContract, context.cookie).getEntry(data)),
  );

// `enabled: false` skips the query for viewers who can't read deck-check; the endpoint
// is staff-only and 403s participants otherwise.
export function useTournamentDeckCheckEntries(tournamentId: string, enabled = true) {
  const userId = useRequiredUserId();
  return useQuery({
    queryKey: tournamentDeckCheckKeys.entries(userId, tournamentId),
    queryFn: () => fetchEntries({ data: tournamentId }),
    enabled,
    staleTime: 0,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
}

export function useTournamentDeckCheckEntry(tournamentId: string, entryId: string) {
  const userId = useRequiredUserId();
  return useQuery({
    queryKey: tournamentDeckCheckKeys.entry(userId, tournamentId, entryId),
    queryFn: () => fetchEntry({ data: { tournamentId, entryId } }),
    staleTime: 0,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
}

const createEntryFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      tournamentId: string;
      participantId: string;
      cards: { name: string; quantity: number; section: string }[];
    }) => input,
  )
  .middleware([withCookies])
  .handler(({ context, data }): Promise<DeckCheckEntryDetailResponse> =>
    apiOrpcClient(tournamentDeckCheckContract, context.cookie).createEntry(data),
  );

const setEntryStateFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      tournamentId: string;
      entryId: string;
      state: "editable" | "submitted" | "approved" | "checked" | "withdrawn";
      reviewOutcome?: "ok" | "issue" | null;
      notes?: string | null;
      playerMessage?: string | null;
    }) => input,
  )
  .middleware([withCookies])
  .handler(({ context, data }): Promise<DeckCheckEntryDetailResponse> =>
    apiOrpcClient(tournamentDeckCheckContract, context.cookie).setEntryState(data),
  );

const denyUnlockRequestFn = createServerFn({ method: "POST" })
  .validator((input: { tournamentId: string; entryId: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<DeckCheckEntryDetailResponse> =>
    apiOrpcClient(tournamentDeckCheckContract, context.cookie).denyUnlockRequest(data),
  );

const updateEntryFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      tournamentId: string;
      entryId: string;
      playerName?: string;
      riotId?: string | null;
      playerMessage?: string | null;
      allowDeckPublishing?: boolean;
      allowNameSharing?: boolean;
      allowRiotIdSharing?: boolean;
    }) => input,
  )
  .middleware([withCookies])
  .handler(({ context, data }): Promise<DeckCheckEntryDetailResponse> =>
    apiOrpcClient(tournamentDeckCheckContract, context.cookie).updateEntry(data),
  );

const deleteEntryFn = createServerFn({ method: "POST" })
  .validator((input: { tournamentId: string; entryId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(tournamentDeckCheckContract, context.cookie).deleteEntry(data);
  });

const unlinkEntryFn = createServerFn({ method: "POST" })
  .validator((input: { tournamentId: string; entryId: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<DeckCheckEntryDetailResponse> =>
    apiOrpcClient(tournamentDeckCheckContract, context.cookie).unlinkEntry(data),
  );

const reResolveFn = createServerFn({ method: "POST" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: tournamentId }): Promise<{ updatedLines: number }> =>
    apiOrpcClient(tournamentDeckCheckContract, context.cookie).reResolve({ tournamentId }),
  );

const addCardFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      tournamentId: string;
      entryId: string;
      name: string;
      quantity: number;
      section: string;
    }) => input,
  )
  .middleware([withCookies])
  .handler(({ context, data }): Promise<DeckCheckEntryDetailResponse> =>
    apiOrpcClient(tournamentDeckCheckContract, context.cookie).addCard(data),
  );

const renameCardFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      tournamentId: string;
      entryId: string;
      cardId: string;
      name: string;
      section?: string;
      copies?: number;
    }) => input,
  )
  .middleware([withCookies])
  .handler(({ context, data }): Promise<DeckCheckEntryDetailResponse> =>
    apiOrpcClient(tournamentDeckCheckContract, context.cookie).renameCard(data),
  );

const applyZoneFixesFn = createServerFn({ method: "POST" })
  .validator((input: { tournamentId: string; entryId: string; cardIds: string[] }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<DeckCheckEntryDetailResponse> =>
    apiOrpcClient(tournamentDeckCheckContract, context.cookie).applyZoneFixes(data),
  );

const removeCardFn = createServerFn({ method: "POST" })
  .validator(
    (input: { tournamentId: string; entryId: string; cardId: string; copyIndex: number }) => input,
  )
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(tournamentDeckCheckContract, context.cookie).removeCardCopy(data);
  });

const tickCardFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      tournamentId: string;
      entryId: string;
      cardId: string;
      copyIndex: number;
      found: boolean;
    }) => input,
  )
  .middleware([withCookies])
  .handler(async ({ context, data }): Promise<{ status: "ok" | "stale" }> => {
    const { error } = await safe(
      apiOrpcClient(tournamentDeckCheckContract, context.cookie).tickCard(data),
    );
    if (error) {
      if (isDefinedError(error) && error.code === "CONFLICT") {
        return { status: "stale" };
      }
      throw error;
    }
    return { status: "ok" };
  });

export function useCreateTournamentDeckCheckEntry() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation({
    mutationFn: (vars: Parameters<typeof createEntryFn>[0]["data"]) =>
      createEntryFn({ data: vars }),
    invalidates: (vars) => deckCheckEntryInvalidationKeys(userId, vars),
  });
}

export function useSetTournamentDeckCheckEntryState() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation({
    mutationFn: (vars: Parameters<typeof setEntryStateFn>[0]["data"]) =>
      setEntryStateFn({ data: vars }),
    invalidates: (vars) => deckCheckEntryInvalidationKeys(userId, vars),
  });
}

export function useDenyTournamentDeckCheckUnlock() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation({
    mutationFn: (vars: { tournamentId: string; entryId: string }) =>
      denyUnlockRequestFn({ data: vars }),
    invalidates: (vars) => deckCheckEntryInvalidationKeys(userId, vars),
  });
}

export function useUpdateTournamentDeckCheckEntry() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation({
    mutationFn: (vars: Parameters<typeof updateEntryFn>[0]["data"]) =>
      updateEntryFn({ data: vars }),
    invalidates: (vars) => deckCheckEntryInvalidationKeys(userId, vars),
  });
}

export function useDeleteTournamentDeckCheckEntry() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation({
    mutationFn: (vars: { tournamentId: string; entryId: string }) => deleteEntryFn({ data: vars }),
    invalidates: (vars) => [tournamentDeckCheckKeys.entries(userId, vars.tournamentId)],
  });
}

export function useUnlinkTournamentDeckCheckEntry() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation({
    mutationFn: (vars: { tournamentId: string; entryId: string }) => unlinkEntryFn({ data: vars }),
    invalidates: (vars) => deckCheckEntryInvalidationKeys(userId, vars),
  });
}

export function useReResolveTournamentDeckCheck() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation({
    mutationFn: (vars: { tournamentId: string }) => reResolveFn({ data: vars.tournamentId }),
    invalidates: (vars) => [tournamentDeckCheckKeys.entries(userId, vars.tournamentId)],
  });
}

export function useAddTournamentDeckCheckCard() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation({
    mutationFn: (vars: Parameters<typeof addCardFn>[0]["data"]) => addCardFn({ data: vars }),
    invalidates: (vars) => deckCheckEntryInvalidationKeys(userId, vars),
  });
}

export function useFixTournamentDeckCheckCard() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation({
    mutationFn: (vars: Parameters<typeof renameCardFn>[0]["data"]) => renameCardFn({ data: vars }),
    invalidates: (vars) => deckCheckEntryInvalidationKeys(userId, vars),
  });
}

export function useApplyTournamentDeckCheckZoneFixes() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation({
    mutationFn: (vars: { tournamentId: string; entryId: string; cardIds: string[] }) =>
      applyZoneFixesFn({ data: vars }),
    invalidates: (vars) => deckCheckEntryInvalidationKeys(userId, vars),
  });
}

export function useRemoveTournamentDeckCheckCard() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation({
    mutationFn: (vars: {
      tournamentId: string;
      entryId: string;
      cardId: string;
      copyIndex: number;
    }) => removeCardFn({ data: vars }),
    invalidates: (vars) => deckCheckEntryInvalidationKeys(userId, vars),
  });
}

type TickVars = Parameters<typeof tickCardFn>[0]["data"];

const TICK_MUTATION_KEY = ["deck-check-tick"];

function withCopyFound(
  detail: DeckCheckEntryDetailResponse | undefined,
  vars: TickVars,
  found: boolean,
): DeckCheckEntryDetailResponse | undefined {
  if (!detail) {
    return detail;
  }
  return {
    ...detail,
    cards: detail.cards.map((card) =>
      card.id === vars.cardId
        ? {
            ...card,
            foundCopies: card.foundCopies.map((value, index) =>
              index === vars.copyIndex ? found : value,
            ),
          }
        : card,
    ),
  };
}

export function useTickTournamentDeckCheckCard() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  const entryKey = (vars: TickVars) =>
    tournamentDeckCheckKeys.entry(userId, vars.tournamentId, vars.entryId);
  return useMutation({
    mutationKey: TICK_MUTATION_KEY,
    mutationFn: (vars: TickVars) => tickCardFn({ data: vars }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: entryKey(vars) });
      queryClient.setQueryData<DeckCheckEntryDetailResponse>(entryKey(vars), (detail) =>
        withCopyFound(detail, vars, vars.found),
      );
    },
    onError: (error, vars) => {
      queryClient.setQueryData<DeckCheckEntryDetailResponse>(entryKey(vars), (detail) =>
        withCopyFound(detail, vars, !vars.found),
      );
      reportMutationError(error, queryClient);
    },
    onSettled: (_data, _error, vars) => {
      // Refetching while another tick is in flight would overwrite its optimistic value.
      if (queryClient.isMutating({ mutationKey: TICK_MUTATION_KEY }) === 1) {
        void queryClient.invalidateQueries({ queryKey: entryKey(vars) });
      }
    },
  });
}
