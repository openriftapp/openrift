import { getRouteApi, Outlet } from "@tanstack/react-router";

import { useSessionExpiredRedirect } from "@/features/account/hooks/use-session-expired-redirect";
import { AuthUserIdContext } from "@/lib/auth-session";

const route = getRouteApi("/_app/_authenticated");

export function AuthenticatedLayout() {
  const { userId } = route.useRouteContext();
  const sessionExpired = useSessionExpiredRedirect();
  if (sessionExpired) {
    return null;
  }
  return (
    <AuthUserIdContext value={userId}>
      <Outlet />
    </AuthUserIdContext>
  );
}
