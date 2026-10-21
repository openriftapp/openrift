import { createFileRoute, redirect } from "@tanstack/react-router";

import { adminAccessQueryOptions } from "@/features/admin/lib/admin-queries";

export const Route = createFileRoute("/_app/_authenticated/admin/workspace/")({
  beforeLoad: async ({ context }) => {
    const access = await context.queryClient.query({
      ...adminAccessQueryOptions(context.userId),
      staleTime: "static",
    });
    if (access.isAdmin || access.sections.includes("card-review")) {
      throw redirect({ to: "/admin/workspace/cards" });
    }
    throw redirect({ to: "/admin/workspace/printings" });
  },
});
