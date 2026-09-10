import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import { adminAccessQueryOptions } from "@/features/admin/hooks/use-admin";
import { unifiedMappingsQueryOptions } from "@/features/admin/hooks/use-unified-mappings";
import { setsQueryOptions } from "@/features/cards/hooks/use-sets";
import { catalogCardsQueryOptions } from "@/features/catalog-admin/hooks/use-catalog-list";
import { CARD_ISSUES, CARD_SEGMENTS } from "@/features/catalog-admin/lib/catalog-card-list";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/catalog/cards/")({
  head: () => adminSeoHead("Cards"),
  validateSearch: z.object({
    segment: z.enum(CARD_SEGMENTS).optional(),
    issue: z.enum(CARD_ISSUES).optional(),
    scope: z.string().optional(),
    set: z.string().optional(),
    q: z.string().optional(),
  }),
  loader: async ({ context }) => {
    const access = context.queryClient.query({
      ...adminAccessQueryOptions(context.userId),
      staleTime: "static",
    });
    await Promise.all([
      context.queryClient.query({ ...catalogCardsQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...setsQueryOptions, staleTime: "static" }),
      access.then(({ isAdmin }) =>
        isAdmin
          ? context.queryClient.query({ ...unifiedMappingsQueryOptions(), staleTime: "static" })
          : undefined,
      ),
    ]);
  },
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
