import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { requireSession } from "@/lib/auth-session";

export const Route = createFileRoute("/_app/_authenticated")({
  errorComponent: RouteErrorFallback,
  beforeLoad: ({ location, context }) => requireSession({ context, location }),
  component: AuthenticatedLayout,
});
