import { useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { useSession } from "@/hooks/use-session";

const AUTHENTICATED_ROUTE_ID = "/_app/_authenticated";

/**
 * Catches a session expiring while `_authenticated` stays mounted (the beforeLoad
 * guard only runs on navigation in). `redirectedRef` stops `navigate`'s own href change from looping.
 */
export function useSessionExpiredRedirect(): boolean {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const router = useRouter();
  const location = useLocation();
  // The layout outlives a pending navigation out of it (sign-out leaves for /cards),
  // so only a location still under `_authenticated` is bounced to /login.
  const [matchedRoutes] = router.getMatchedRoutes(location.pathname);
  const targetIsAuthenticated = matchedRoutes.some((route) => route.id === AUTHENTICATED_ROUTE_ID);
  const expired = session === null;
  const currentHref = location.href;
  const redirectedRef = useRef(false);
  useEffect(() => {
    if (!expired) {
      redirectedRef.current = false;
      return;
    }
    if (redirectedRef.current || !targetIsAuthenticated) {
      return;
    }
    redirectedRef.current = true;
    void navigate({
      to: "/login",
      search: { redirect: currentHref || undefined, email: undefined },
    });
  }, [expired, targetIsAuthenticated, navigate, currentHref]);
  return expired;
}
