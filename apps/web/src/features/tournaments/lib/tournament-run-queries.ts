import { publicPodTournamentsContract } from "@openrift/shared/contracts/public-pod-tournaments";
import { tournamentsContract } from "@openrift/shared/contracts/tournaments";
import type {
  PodReportResponse,
  PodTournamentDetailResponse,
} from "@openrift/shared/types/api/pod-tournament";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { openRoundRefetchInterval } from "@/features/tournaments/lib/open-round-polling";
import { podTournamentsKeys } from "@/features/tournaments/lib/tournaments-query-keys";
import { orNotFound } from "@/lib/server-fns/api-error";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchRunState = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: id }): Promise<PodTournamentDetailResponse> =>
    orNotFound(apiOrpcClient(tournamentsContract, context.cookie).runState({ id })),
  );

const fetchReport = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .handler(({ data: token }): Promise<PodReportResponse> =>
    orNotFound(apiOrpcClient(publicPodTournamentsContract).report({ token })),
  );

export function tournamentRunStateQueryOptions(userId: string, id: string) {
  return queryOptions({
    queryKey: podTournamentsKeys.detail(userId, id),
    queryFn: () => fetchRunState({ data: id }),
    refetchInterval: (query) => openRoundRefetchInterval(query.state.data),
  });
}

export function tournamentReportQueryOptions(token: string) {
  return queryOptions({
    queryKey: podTournamentsKeys.report(token),
    queryFn: () => fetchReport({ data: token }),
    refetchInterval: (query) => openRoundRefetchInterval(query.state.data),
  });
}
