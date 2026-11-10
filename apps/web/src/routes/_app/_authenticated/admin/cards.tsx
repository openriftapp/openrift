import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/mini";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import {
  adminCardListQueryOptions,
  allCardsQueryOptions,
} from "@/features/admin/lib/admin-card-queries";
import { adminAccessQueryOptions } from "@/features/admin/lib/admin-queries";
import { CARD_ISSUES } from "@/features/admin/lib/admin-search-values";
import { providerSettingsQueryOptions } from "@/features/admin/lib/provider-settings-queries";
import { unifiedMappingsSummaryQueryOptions } from "@/features/admin/lib/unified-mappings-queries";
import { setsQueryOptions } from "@/features/cards/lib/sets-queries";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/cards")({
  head: () => adminSeoHead("Cards"),
  validateSearch: z.object({
    set: z.optional(z.string()),
    // "cards", "candidates" and "unmatched" are older values, kept so a stale
    // bookmark still validates.
    tab: z.optional(z.enum(["attention", "drafts", "cards", "candidates", "unmatched"])),
    q: z.optional(z.string()),
    tableSort: z.optional(z.string()),
    issue: z.optional(z.enum(CARD_ISSUES)),
    // Older filter params, still read so old links keep filtering.
    status: z.optional(z.enum(["unchecked", "new-printings", "prices-to-assign"])),
    // Only meaningful while `issue` is "unlinked-products", e.g. "cardtrader:FR".
    priceScope: z.optional(z.string()),
    source: z.optional(z.enum(["usersubmission"])),
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
        ? [
            context.queryClient.query({
              ...unifiedMappingsSummaryQueryOptions(),
              staleTime: "static",
            }),
          ]
        : []),
      context.queryClient.query({ ...setsQueryOptions, staleTime: "static" }),
    ]);
  },
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
