import { createFileRoute, redirect } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { sessionQueryOptions } from "@/lib/auth-session";

export const Route = createFileRoute("/_app/_authenticated")({
  errorComponent: RouteErrorFallback,
  beforeLoad: async ({ location, context }) => {
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
  },
  component: AuthenticatedLayout,
});
