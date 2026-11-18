import { createFileRoute, redirect } from "@tanstack/react-router";

import { AppLayout } from "@/components/layout/app-layout";
import {
  redirectWithoutSubmittedFields,
  requireSession,
  sessionQueryOptions,
} from "@/lib/auth-session";
import { isStageTierPath, stageRedirectHref } from "@/lib/stage-access-gate";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    redirectWithoutSubmittedFields(location);
    const stageHref = stageRedirectHref(location);
    if (stageHref !== undefined) {
      throw redirect({ href: stageHref, replace: true });
    }
    // Preload session so the Header can render auth-dependent UI during SSR.
    // Non-critical: if it fails, the client-side useQuery will retry.
    const sessionLoaded = await context.queryClient
      .query({ ...sessionQueryOptions(), staleTime: "static" })
      .then(() => true)
      .catch(() => false);
    // The browser-only stage gate would redirect after the server HTML shows;
    // a failed lookup is left to it, so its error renders inside the shell.
    if (import.meta.env.SSR && sessionLoaded && isStageTierPath(location)) {
      await requireSession({ context, location });
    }
  },
  component: AppLayout,
});
