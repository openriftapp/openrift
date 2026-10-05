import { useQuery } from "@tanstack/react-query";
import { createContext, use } from "react";

import { sessionQueryOptions } from "@/lib/auth-session";
import { captureHandledError } from "@/lib/report-error";

/** Drop-in replacement for better-auth's useSession(); reads from the React Query cache. */
export function useSession() {
  return useQuery(sessionQueryOptions());
}

/** For hooks that may run on public pages where authentication is optional. */
export function useUserId(): string | null {
  const { data: session } = useSession();
  return session?.user?.id ?? null;
}

/** Carries the id `_authenticated`'s beforeLoad resolved, which survives an empty client query cache. */
export const AuthUserIdContext = createContext<string | undefined>(undefined);

let fallbackReported = false;

function reportSessionFallbackOnce(): void {
  if (fallbackReported || globalThis.window === undefined) {
    return;
  }
  fallbackReported = true;
  captureHandledError(
    new Error("useRequiredUserId() fell back to the route context: no session in the query cache."),
    { session_fallback: "true" },
  );
}

/** For hooks on `_authenticated` routes only; reaching the throw means it was called from a public route. */
export function useRequiredUserId(): string {
  const sessionUserId = useUserId();
  const routeUserId = use(AuthUserIdContext);
  if (sessionUserId) {
    return sessionUserId;
  }
  if (routeUserId) {
    reportSessionFallbackOnce();
    return routeUserId;
  }
  throw new Error(
    "useRequiredUserId() called without an authenticated session. " +
      "Move this call inside an `_authenticated` route, or switch to useUserId() and handle the null case.",
  );
}
