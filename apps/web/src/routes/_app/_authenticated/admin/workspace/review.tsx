import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/mini";

import { AdminPending } from "@/features/admin/components/admin-route-components";
import { reviewCardsQueryOptions } from "@/features/catalog-workspace/lib/review-cards";
import { lenient } from "@/lib/lenient-param";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/workspace/review")({
  head: () => adminSeoHead("Review"),
  validateSearch: z.object({ q: lenient(z.string()), only: lenient(z.enum(["ready"])) }),
  loader: async ({ context }) => {
    await context.queryClient.query({ ...reviewCardsQueryOptions(), staleTime: "static" });
  },
  pendingComponent: AdminPending,
});
