import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/mini";

import { AdminPending } from "@/features/admin/components/admin-route-components";
import { listingsQueryOptions } from "@/features/catalog-workspace/lib/listings-queries";
import { lenient } from "@/lib/lenient-param";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/workspace/listings")({
  validateSearch: z.object({ q: lenient(z.string()), card: lenient(z.string()) }),
  loader: async ({ context }) => {
    await context.queryClient.query({ ...listingsQueryOptions(), staleTime: "static" });
  },
  head: () => adminSeoHead("Listings"),
  pendingComponent: AdminPending,
});
