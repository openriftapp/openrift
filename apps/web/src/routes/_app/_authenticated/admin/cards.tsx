import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import { adminAccessQueryOptions } from "@/features/admin/hooks/use-admin";
import {
  adminCardListQueryOptions,
  allCardsQueryOptions,
} from "@/features/admin/hooks/use-admin-card-queries";
import { providerSettingsQueryOptions } from "@/features/admin/hooks/use-provider-settings";
import { unifiedMappingsQueryOptions } from "@/features/admin/hooks/use-unified-mappings";
import { CARD_ISSUES } from "@/features/admin/lib/card-attention";
import { setsQueryOptions } from "@/features/cards/hooks/use-sets";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/cards")({
  head: () => adminSeoHead("Cards"),
  validateSearch: z.object({
    set: z.string().optional(),
    // "cards", "candidates" and "unmatched" are older values, kept so a stale
    // bookmark still validates.
    tab: z.enum(["attention", "drafts", "cards", "candidates", "unmatched"]).optional(),
    q: z.string().optional(),
    tableSort: z.string().optional(),
    issue: z.enum(CARD_ISSUES).optional(),
    // Older filter params, still read so old links keep filtering.
    status: z.enum(["unchecked", "new-printings", "prices-to-assign"]).optional(),
    // Only meaningful while `issue` is "unlinked-products", e.g. "cardtrader:FR".
    priceScope: z.string().optional(),
    source: z.enum(["usersubmission"]).optional(),
  }),
  loader: async ({ context }) => {
    // Unified mappings are a marketplace endpoint that card-review grant
    // holders cannot reach; only prefetch it for full admins.
    const access = await context.queryClient.query({
      ...adminAccessQueryOptions(context.userId),
      staleTime: "static",
    });
    await Promise.all([
      context.queryClient.query({ ...adminCardListQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...providerSettingsQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...allCardsQueryOptions, staleTime: "static" }),
      ...(access.isAdmin
        ? [context.queryClient.query({ ...unifiedMappingsQueryOptions(), staleTime: "static" })]
        : []),
      context.queryClient.query({ ...setsQueryOptions, staleTime: "static" }),
    ]);
  },
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
