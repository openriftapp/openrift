import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { marketplaceEnum } from "@openrift/shared/types/pricing";
import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import {
  adminCardDetailQueryOptions,
  allCardsQueryOptions,
} from "@/features/admin/lib/admin-card-queries";
import { adminAccessQueryOptions } from "@/features/admin/lib/admin-queries";
import type { AdminCardListStatus } from "@/features/admin/lib/card-attention";
import { ADMIN_CARD_LIST_STATUSES } from "@/features/admin/lib/card-attention";
import type { CardSection } from "@/features/admin/lib/card-sections";
import { isCardSection } from "@/features/admin/lib/card-sections";
import { providerSettingsQueryOptions } from "@/features/admin/lib/provider-settings-queries";
import { unifiedMappingsForCardQueryOptions } from "@/features/admin/lib/unified-mappings-queries";
import { adminDistinctArtistsQueryOptions } from "@/features/cards/lib/distinct-artists-queries";
import { adminLanguagesQueryOptions } from "@/lib/languages-queries";
import { adminMarkersQueryOptions } from "@/lib/markers-queries";
import { adminSeoHead } from "@/lib/seo";

interface CardDetailSearch {
  section?: CardSection;
  focusMarketplace?: Marketplace;
  focusFinish?: string;
  focusLanguage?: string;
  focusField?: string;
  set?: string;
  status?: AdminCardListStatus;
  priceScope?: string;
}

export const Route = createFileRoute("/_app/_authenticated/admin/cards_/$cardSlug")({
  head: ({ loaderData }) => {
    const data = loaderData as AdminCardDetailResponse | undefined;
    return adminSeoHead(data?.displayName ?? "Card");
  },
  validateSearch: (search: Record<string, unknown>): CardDetailSearch => {
    const result: CardDetailSearch = {};
    if (isCardSection(search.section)) {
      result.section = search.section;
    } else if (search.section === "fields") {
      result.section = "printings";
    }
    const focusMarketplace = marketplaceEnum.safeParse(search.focusMarketplace);
    if (focusMarketplace.success) {
      result.focusMarketplace = focusMarketplace.data;
    }
    if (typeof search.focusFinish === "string") {
      result.focusFinish = search.focusFinish;
    }
    if (typeof search.focusLanguage === "string") {
      result.focusLanguage = search.focusLanguage;
    }
    if (typeof search.focusField === "string" && search.focusField.length > 0) {
      result.focusField = search.focusField;
    }
    if (typeof search.set === "string" && search.set.length > 0) {
      result.set = search.set;
    }
    if (search.status === "prices-to-assign") {
      result.status = "prices-to-assign";
      // The scope only means anything alongside the filter it belongs to, and
      // the umbrella scope is represented by an absent param.
      if (typeof search.priceScope === "string" && search.priceScope.length > 0) {
        result.priceScope = search.priceScope;
      }
    }
    const status = ADMIN_CARD_LIST_STATUSES.find((option) => option === search.status);
    if (status !== undefined && status !== "prices-to-assign") {
      result.status = status;
    }
    return result;
  },
  loader: async ({ context, params }) => {
    // The marketplace section is admin-only; card-review grant holders
    // cannot reach its endpoint.
    const access = await context.queryClient.query({
      ...adminAccessQueryOptions(context.userId),
      staleTime: "static",
    });
    const [detail] = await Promise.all([
      context.queryClient.query({
        ...adminCardDetailQueryOptions(params.cardSlug),
        staleTime: "static",
      }),
      context.queryClient.query({ ...adminMarkersQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...providerSettingsQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...allCardsQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...adminDistinctArtistsQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...adminLanguagesQueryOptions, staleTime: "static" }),
      // The endpoint accepts a slug, so this can run in parallel with the
      // card detail fetch without waiting for the UUID resolution.
      ...(access.isAdmin
        ? [
            context.queryClient.query({
              ...unifiedMappingsForCardQueryOptions(params.cardSlug),
              staleTime: "static",
            }),
          ]
        : []),
    ]);
    return detail;
  },
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
