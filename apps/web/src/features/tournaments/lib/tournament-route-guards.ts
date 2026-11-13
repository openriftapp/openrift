import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";

import { tournamentRunStateQueryOptions } from "@/features/tournaments/lib/tournament-run-queries";
import { tournamentDetailQueryOptions } from "@/features/tournaments/lib/tournaments-queries";
import { notFoundOnSentinel } from "@/lib/server-fns/api-error";

export function loadTournamentDetail(queryClient: QueryClient, userId: string, id: string) {
  return notFoundOnSentinel(
    queryClient.query({ ...tournamentDetailQueryOptions(userId, id), staleTime: "static" }),
  );
}

export function loadTournamentRunState(queryClient: QueryClient, userId: string, id: string) {
  return queryClient.query({ ...tournamentRunStateQueryOptions(userId, id), staleTime: "static" });
}

export function redirectToTournamentOverview(id: string): never {
  throw redirect({ to: "/tournaments/$id", params: { id } });
}
