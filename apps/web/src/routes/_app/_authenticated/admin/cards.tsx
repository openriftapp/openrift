import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/mini";

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
import { lenient } from "@/lib/lenient-param";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/cards")({
  head: () => adminSeoHead("Cards"),
  validateSearch: z.object({
    set: lenient(z.string()),
    tab: lenient(z.enum(["attention", "drafts"])),
    q: lenient(z.string()),
    tableSort: lenient(z.string()),
    issue: lenient(z.enum(CARD_ISSUES)),
    // Only meaningful while `issue` is "unlinked-products", e.g. "cardtrader:FR".
    priceScope: lenient(z.string()),
  }),
  loaderDeps: ({ search }) => ({ set: search.set }),
  loader: async ({ context, deps, cause }) => {
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
      // A set change on this page does not wait for the summary; the page keeps
      // the previous count until its own query answers.
      ...(access.isAdmin && cause !== "stay"
        ? [
            context.queryClient.query({
              ...unifiedMappingsSummaryQueryOptions(deps.set),
              staleTime: "static",
            }),
          ]
        : []),
      context.queryClient.query({ ...setsQueryOptions, staleTime: "static" }),
    ]);
  },
  pendingComponent: AdminPending,
});
