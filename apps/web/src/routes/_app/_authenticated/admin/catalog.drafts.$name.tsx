import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import {
  allCardsQueryOptions,
  unmatchedCardDetailQueryOptions,
} from "@/features/admin/hooks/use-admin-card-queries";
import { providerSettingsQueryOptions } from "@/features/admin/hooks/use-provider-settings";
import { catalogCardsQueryOptions } from "@/features/catalog-admin/hooks/use-catalog-list";
import { reviewQueueQueryOptions } from "@/features/catalog-admin/hooks/use-catalog-review";
import { CARD_ISSUES, CARD_SEGMENTS } from "@/features/catalog-admin/lib/catalog-card-list";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/catalog/drafts/$name")({
  validateSearch: z.object({
    from: z.enum(["review", "cards"]).optional(),
    filter: z.enum(["all", "contributors", "sources"]).optional(),
    segment: z.enum(CARD_SEGMENTS).optional(),
    issue: z.enum(CARD_ISSUES).optional(),
    scope: z.string().optional(),
    set: z.string().optional(),
    q: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({ fromCards: search.from === "cards" }),
  head: ({ params }) => adminSeoHead(params.name),
  loader: async ({ context, params, deps }) => {
    await Promise.all([
      context.queryClient.query({
        ...unmatchedCardDetailQueryOptions(params.name),
        staleTime: "static",
      }),
      context.queryClient.query({ ...providerSettingsQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...allCardsQueryOptions, staleTime: "static" }),
      deps.fromCards
        ? context.queryClient.query({ ...catalogCardsQueryOptions, staleTime: "static" })
        : context.queryClient.query({ ...reviewQueueQueryOptions, staleTime: "static" }),
    ]);
  },
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
