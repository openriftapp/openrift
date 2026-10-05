import { publicTournamentsContract } from "@openrift/shared/contracts/public-tournaments";
import { tournamentsContract } from "@openrift/shared/contracts/tournaments";
import type {
  PublicTournamentLandingResponse,
  TournamentDetailResponse,
  TournamentListResponse,
  TournamentParticipantListResponse,
  TournamentStaffInviteLandingResponse,
} from "@openrift/shared/types/api/tournament";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { tournamentsKeys } from "@/features/tournaments/lib/tournaments-query-keys";
import { orNotFound } from "@/lib/server-fns/api-error";
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
  .handler(({ context, data: id }): Promise<TournamentDetailResponse> =>
    orNotFound(apiOrpcClient(tournamentsContract, context.cookie).get({ id })),
  );

const fetchGroupTournaments = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: slug }): Promise<TournamentListResponse> =>
    apiOrpcClient(tournamentsContract, context.cookie).listForGroup({ slug }),
  );

const fetchParticipants = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: id }): Promise<TournamentParticipantListResponse> =>
    orNotFound(apiOrpcClient(tournamentsContract, context.cookie).listParticipants({ id })),
  );

const fetchSubmitLanding = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .handler(({ data: token }): Promise<PublicTournamentLandingResponse> =>
    orNotFound(apiOrpcClient(publicTournamentsContract).landing({ token })),
  );

const fetchStaffInviteLanding = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: token }): Promise<TournamentStaffInviteLandingResponse> =>
    orNotFound(
      apiOrpcClient(publicTournamentsContract, context.cookie).staffInviteLanding({ token }),
    ),
  );

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
