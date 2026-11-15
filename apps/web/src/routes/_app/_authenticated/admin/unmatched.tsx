import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/mini";

import { AdminPending } from "@/features/admin/components/admin-route-components";
import { unifiedMappingsQueryOptions } from "@/features/admin/lib/unified-mappings-queries";
import { setsQueryOptions } from "@/features/cards/lib/sets-queries";
import { lenient } from "@/lib/lenient-param";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/unmatched")({
  validateSearch: z.object({
    set: lenient(z.string()),
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.query({ ...unifiedMappingsQueryOptions(), staleTime: "static" }),
      context.queryClient.query({ ...setsQueryOptions, staleTime: "static" }),
    ]);
  },
  head: () => adminSeoHead("Unmatched products"),
  pendingComponent: AdminPending,
});
