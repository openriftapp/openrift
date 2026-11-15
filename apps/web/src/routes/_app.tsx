import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/components/layout/app-layout";
import { requireSession, sessionQueryOptions } from "@/lib/auth-session";
import { isStageTierPath } from "@/lib/stage-access-gate";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    // Preload session so the Header can render auth-dependent UI during SSR.
    // Non-critical: if it fails, the client-side useQuery will retry.
    await context.queryClient
      .query({ ...sessionQueryOptions(), staleTime: "static" })
      .catch(() => null);
    // The stage renders only in the browser, so its own `?tier=` gate would
    // redirect after the server HTML is already on screen.
    if (import.meta.env.SSR && isStageTierPath(location)) {
      await requireSession({ context, location });
    }
  },
  component: AppLayout,
});
