import { createFileRoute, redirect } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import { adminDistributionChannelsQueryOptions } from "@/features/admin/lib/distribution-channels-queries";
import { adminMarkersQueryOptions } from "@/features/admin/lib/markers-queries";
import { deskCardPrintingsQueryOptions } from "@/features/admin/lib/printing-desk-queries";
import { adminDistinctArtistsQueryOptions } from "@/features/cards/lib/distinct-artists-queries";
import { setsQueryOptions } from "@/features/cards/lib/sets-queries";
import { initQueryOptions } from "@/lib/init-queries";
import { adminSeoHead } from "@/lib/seo";

interface NewPrintingSearch {
  card: string;
}

export const Route = createFileRoute("/_app/_authenticated/admin/printing-desk_/new")({
  head: () => adminSeoHead("New printing"),
  validateSearch: (search: Record<string, unknown>): NewPrintingSearch => ({
    card: typeof search.card === "string" ? search.card : "",
  }),
  loaderDeps: ({ search }) => ({ card: search.card }),
  loader: async ({ context, deps }) => {
    if (deps.card.length === 0) {
      throw redirect({ to: "/admin/printing-desk" });
    }
    await Promise.all([
      context.queryClient.query({
        ...deskCardPrintingsQueryOptions(deps.card),
        staleTime: "static",
      }),
      context.queryClient.query({ ...setsQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...adminMarkersQueryOptions, staleTime: "static" }),
      context.queryClient.query({
        ...adminDistributionChannelsQueryOptions,
        staleTime: "static",
      }),
      context.queryClient.query({ ...adminDistinctArtistsQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
    ]);
  },
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
