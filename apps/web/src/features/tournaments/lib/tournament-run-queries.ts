import { publicPodTournamentsContract } from "@openrift/shared/contracts/public-pod-tournaments";
import { tournamentsContract } from "@openrift/shared/contracts/tournaments";
import type {
  PodReportResponse,
  PodTournamentDetailResponse,
} from "@openrift/shared/types/api/pod-tournament";
import { isDefinedError, safe } from "@orpc/client";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { openRoundRefetchInterval } from "@/features/tournaments/lib/open-round-polling";
import { podTournamentsKeys } from "@/features/tournaments/lib/tournaments-query-keys";
import { notFoundError } from "@/lib/server-fns/api-error";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchRunState = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(async ({ context, data: id }): Promise<PodTournamentDetailResponse> => {
    // 404 (unknown / no relationship) maps to the sentinel the route boundary
    // expects; 403 (not a manager, for a mutation) propagates as a normal error.
    const { error, data } = await safe(
      apiOrpcClient(tournamentsContract, context.cookie).runState({ id }),
    );
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw notFoundError();
      }
      throw error;
    }
    return data;
  });

const fetchReport = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .handler(async ({ data: token }): Promise<PodReportResponse> => {
    // 404 (disabled/rotated token) maps to the sentinel the route boundary expects.
    const { error, data } = await safe(
      apiOrpcClient(publicPodTournamentsContract).report({ token }),
    );
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw notFoundError();
      }
      throw error;
    }
    return data;
  });

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
