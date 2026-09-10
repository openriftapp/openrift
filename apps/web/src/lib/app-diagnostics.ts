import type { QueryClient } from "@tanstack/react-query";
import type { AnyRouter } from "@tanstack/react-router";

import { sessionQueryOptions } from "./auth-session";

type SessionState = "absent" | "fetching" | "empty" | "null" | "user";

interface AppDiagnostics {
  msSinceBoot: number;
  hydrationSettled: boolean;
  queryCount: number;
  sessionState: SessionState;
  sessionUpdatedAt: number;
  pathname: string;
  matchedRouteIds: string;
}

const bootedAt = Date.now();
let diagnosticQueryClient: QueryClient | null = null;
let diagnosticRouter: AnyRouter | null = null;
let hydrationSettled = false;

/**
 * Client-only: these module-level handles would outlive a request on the
 * server, where every render builds its own router and query client.
 */
export function setDiagnosticsSources(sources: {
  queryClient: QueryClient;
  router: AnyRouter;
}): void {
  diagnosticQueryClient = sources.queryClient;
  diagnosticRouter = sources.router;
}

export function markHydrationSettled(): void {
  hydrationSettled = true;
}

export function isHydrationSettled(): boolean {
  return hydrationSettled;
}

function readSessionState(client: QueryClient): { state: SessionState; updatedAt: number } {
  const query = client
    .getQueryCache()
    .find({ queryKey: sessionQueryOptions().queryKey, exact: true });
  if (!query) {
    return { state: "absent", updatedAt: 0 };
  }
  const { data, dataUpdatedAt, fetchStatus } = query.state;
  if (data === undefined) {
    return { state: fetchStatus === "fetching" ? "fetching" : "empty", updatedAt: dataUpdatedAt };
  }
  return { state: data === null ? "null" : "user", updatedAt: dataUpdatedAt };
}

export function getAppDiagnostics(): Partial<AppDiagnostics> {
  const base = { msSinceBoot: Date.now() - bootedAt, hydrationSettled };
  if (!diagnosticQueryClient || !diagnosticRouter) {
    return base;
  }
  const session = readSessionState(diagnosticQueryClient);
  return {
    ...base,
    queryCount: diagnosticQueryClient.getQueryCache().getAll().length,
    sessionState: session.state,
    sessionUpdatedAt: session.updatedAt,
    pathname: diagnosticRouter.state.location.pathname,
    matchedRouteIds: diagnosticRouter.state.matches.map((match) => match.routeId).join(" "),
  };
}
