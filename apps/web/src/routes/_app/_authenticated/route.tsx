import { createFileRoute } from "@tanstack/react-router";

import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { isAdminPath, requireAdminAccess } from "@/lib/admin-access-gate";
import { requireSession } from "@/lib/auth-session";

export const Route = createFileRoute("/_app/_authenticated")({
  beforeLoad: async ({ location, context }) => {
    const session = await requireSession({ context, location });
    // The admin layout renders only in the browser, so its gate would redirect
    // after the server HTML for /admin is already on screen.
    if (import.meta.env.SSR && isAdminPath(location.pathname)) {
      await requireAdminAccess({ context: { ...context, userId: session.userId }, location });
    }
    return session;
  },
  component: AuthenticatedLayout,
});
