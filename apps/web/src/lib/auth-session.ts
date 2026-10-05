// During SSR, the better-auth client can't forward cookies automatically, so
// this server function reads them from the incoming request and forwards them.

import type { QueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { fetchApi } from "./server-fns/fetch-api";
import { withCookies } from "./server-fns/middleware";

interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  riotId?: string | null;
  bio?: string | null;
  profileShowRiotId?: boolean;
  profileShowCollection?: boolean;
  profileShowLastActive?: boolean;
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

/** For `beforeLoad` / `loader`: redirects a signed-out visitor to /login and back to `location.href`. */
export async function requireSession({
  context,
  location,
}: {
  context: { queryClient: QueryClient };
  location: { href: string };
}): Promise<{ userId: string }> {
  const session = await context.queryClient.query({
    ...sessionQueryOptions(),
    staleTime: "static",
  });
  if (!session?.user) {
    throw redirect({
      to: "/login",
      search: { redirect: location.href || undefined, email: undefined },
    });
  }
  return { userId: session.user.id };
}
