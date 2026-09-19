import { publicTournamentsContract } from "@openrift/shared/contracts/public-tournaments";
import { tournamentsContract } from "@openrift/shared/contracts/tournaments";
import type {
  PublicTournamentLandingResponse,
  TournamentDetailResponse,
  TournamentListResponse,
  TournamentParticipantListResponse,
  TournamentStaffInviteLandingResponse,
} from "@openrift/shared/types/api/tournament";
import { isDefinedError, safe } from "@orpc/client";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { tournamentsKeys } from "@/features/tournaments/lib/tournaments-query-keys";
import { notFoundError } from "@/lib/server-fns/api-error";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchTournaments = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<TournamentListResponse> =>
    apiOrpcClient(tournamentsContract, context.cookie).list(),
  );

const fetchTournamentDetail = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(async ({ context, data: id }): Promise<TournamentDetailResponse> => {
    // 404 maps to the sentinel the route boundary expects; other errors propagate.
    const { error, data } = await safe(
      apiOrpcClient(tournamentsContract, context.cookie).get({ id }),
    );
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw notFoundError();
      }
      throw error;
    }
    return data;
  });

const fetchGroupTournaments = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: slug }): Promise<TournamentListResponse> =>
    apiOrpcClient(tournamentsContract, context.cookie).listForGroup({ slug }),
  );

const fetchParticipants = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(async ({ context, data: id }): Promise<TournamentParticipantListResponse> => {
    // Map the deleted-tournament 404 to the sentinel like the other fetchers,
    // so a stale tab polling a gone tournament doesn't spam Sentry with raw
    // ORPCErrors.
    const { error, data } = await safe(
      apiOrpcClient(tournamentsContract, context.cookie).listParticipants({ id }),
    );
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw notFoundError();
      }
      throw error;
    }
    return data;
  });

const fetchSubmitLanding = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .handler(async ({ data: token }): Promise<PublicTournamentLandingResponse> => {
    const { error, data } = await safe(apiOrpcClient(publicTournamentsContract).landing({ token }));
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw notFoundError();
      }
      throw error;
    }
    return data;
  });

const fetchStaffInviteLanding = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(async ({ context, data: token }): Promise<TournamentStaffInviteLandingResponse> => {
    const { error, data } = await safe(
      apiOrpcClient(publicTournamentsContract, context.cookie).staffInviteLanding({ token }),
    );
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw notFoundError();
      }
      throw error;
    }
    return data;
  });

export function tournamentsQueryOptions(userId: string) {
  return queryOptions({
    queryKey: tournamentsKeys.all(userId),
    queryFn: () => fetchTournaments(),
  });
}

export function tournamentDetailQueryOptions(userId: string, id: string) {
  return queryOptions({
    queryKey: tournamentsKeys.detail(userId, id),
    queryFn: () => fetchTournamentDetail({ data: id }),
  });
}

export function groupTournamentsQueryOptions(userId: string, slug: string) {
  return queryOptions({
    queryKey: tournamentsKeys.forGroup(userId, slug),
    queryFn: () => fetchGroupTournaments({ data: slug }),
  });
}

export function tournamentParticipantsQueryOptions(userId: string, id: string) {
  return queryOptions({
    queryKey: tournamentsKeys.participants(userId, id),
    queryFn: () => fetchParticipants({ data: id }),
  });
}

export function tournamentSubmitLandingQueryOptions(token: string) {
  return queryOptions({
    queryKey: tournamentsKeys.submitLanding(token),
    queryFn: () => fetchSubmitLanding({ data: token }),
  });
}

export function tournamentStaffInviteLandingQueryOptions(token: string) {
  return queryOptions({
    queryKey: tournamentsKeys.staffInviteLanding(token),
    queryFn: () => fetchStaffInviteLanding({ data: token }),
  });
}
