import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/components/layout/app-layout";
import { sessionQueryOptions } from "@/lib/auth-session";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => {
    // Preload session so the Header can render auth-dependent UI during SSR.
    // Non-critical: if it fails, the client-side useQuery will retry.
    await context.queryClient
      .query({ ...sessionQueryOptions(), staleTime: "static" })
      .catch(() => null);
  },
  component: AppLayout,
});
