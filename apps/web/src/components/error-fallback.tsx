import { toError } from "@openrift/shared/strings";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { rootRouteId, useMatch } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { captureHandledError } from "@/lib/report-error";
import { reloadIfNewVersionPending } from "@/lib/stale-bundle-reload";

// These boundaries sit above AppLayout, so the header is gone with the failed match.
const SHELL_LESS_ROUTE_IDS = new Set<string>([rootRouteId, "/_app"]);

export function RouterErrorFallback({ error }: ErrorComponentProps) {
  const routeId = useMatch({ strict: false, shouldThrow: false, select: (match) => match.routeId });
  const normalizedError = toError(error);
  if (typeof document === "undefined") {
    // SSR has no onCaughtError; in the browser client.tsx reports this with the
    // hydration phase, and a second capture here would win Sentry's dedupe.
    captureHandledError(normalizedError, { boundary: "router" });
  } else if (reloadIfNewVersionPending()) {
    // A deploy while the tab is open breaks calls the old bundle makes; reload
    // through it instead of showing the error page when a new version is pending.
    return null;
  }
  const view = (
    <RouteErrorFallback error={error} details={normalizedError.stack ?? normalizedError.message} />
  );
  if (routeId !== undefined && !SHELL_LESS_ROUTE_IDS.has(routeId)) {
    return view;
  }
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center">
      {view}
    </div>
  );
}
