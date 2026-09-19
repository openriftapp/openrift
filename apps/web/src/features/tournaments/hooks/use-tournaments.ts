import { tournamentsContract } from "@openrift/shared/contracts/tournaments";
import type { TournamentStaffCandidateListResponse } from "@openrift/shared/types/api/tournament";
import { isDefinedError, safe } from "@orpc/client";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import {
  groupTournamentsQueryOptions,
  tournamentDetailQueryOptions,
  tournamentParticipantsQueryOptions,
  tournamentsQueryOptions,
  tournamentStaffInviteLandingQueryOptions,
  tournamentSubmitLandingQueryOptions,
} from "@/features/tournaments/lib/tournaments-queries";
import { tournamentsKeys } from "@/features/tournaments/lib/tournaments-query-keys";
import { useRequiredUserId } from "@/lib/auth-session";
import { notFoundError } from "@/lib/server-fns/api-error";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchStaffCandidates = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(async ({ context, data: id }): Promise<TournamentStaffCandidateListResponse> => {
    const { error, data } = await safe(
      apiOrpcClient(tournamentsContract, context.cookie).listStaffCandidates({ id }),
    );
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw notFoundError();
      }
      throw error;
    }
    return data;
  });

function tournamentStaffCandidatesQueryOptions(userId: string, id: string) {
  return queryOptions({
    queryKey: tournamentsKeys.staffCandidates(userId, id),
    queryFn: () => fetchStaffCandidates({ data: id }),
  });
}

export function useTournaments() {
  const userId = useRequiredUserId();
  return useSuspenseQuery(tournamentsQueryOptions(userId));
}

export function useTournamentDetail(id: string) {
  const userId = useRequiredUserId();
  return useSuspenseQuery(tournamentDetailQueryOptions(userId, id));
}

export function useGroupTournaments(slug: string) {
  const userId = useRequiredUserId();
  return useSuspenseQuery(groupTournamentsQueryOptions(userId, slug));
}

export function useTournamentParticipants(id: string) {
  const userId = useRequiredUserId();
  return useSuspenseQuery(tournamentParticipantsQueryOptions(userId, id));
}

export function useTournamentSubmitLanding(token: string) {
  return useSuspenseQuery(tournamentSubmitLandingQueryOptions(token));
}

/**
 * Eligible staff candidates for the add-staff picker. Non-suspense and gated on
 * `enabled` so it fetches only when the dialog opens, never suspending the page.
 * @returns The candidate-list query.
 */
export function useTournamentStaffCandidates(id: string, enabled = true) {
  const userId = useRequiredUserId();
  return useQuery({ ...tournamentStaffCandidatesQueryOptions(userId, id), enabled });
}

export function useTournamentStaffInviteLanding(token: string) {
  return useSuspenseQuery(tournamentStaffInviteLandingQueryOptions(token));
}
