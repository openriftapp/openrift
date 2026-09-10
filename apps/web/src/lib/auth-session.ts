// During SSR, the better-auth client can't forward cookies automatically, so
// this server function reads them from the incoming request and forwards them.

import { queryOptions, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { createContext, use } from "react";

import { captureHandledError } from "./report-error";
import { fetchApi } from "./server-fns/fetch-api";
import { withCookies } from "./server-fns/middleware";

interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  riotId?: string | null;
  createdAt: string;
  updatedAt: string;
}

type SessionData = {
  session: { id: string; userId: string; expiresAt: string; token: string };
  user: SessionUser;
} | null;

const getServerSession = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(async ({ context }): Promise<SessionData> => {
    // 401 is the expected state for unauthenticated users; other non-ok
    // statuses still surface as errors.
    const res = await fetchApi({
      errorTitle: "Couldn't load session",
      cookie: context.cookie,
      path: "/api/auth/get-session",
      acceptStatuses: [401],
    });
    if (!res.ok) {
      return null;
    }
    return res.json();
  });

export const sessionQueryOptions = () =>
  queryOptions({
    queryKey: ["session"],
    queryFn: () => getServerSession(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

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
