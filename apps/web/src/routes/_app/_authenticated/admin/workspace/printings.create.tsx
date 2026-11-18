import { createFileRoute } from "@tanstack/react-router";

import { AdminPending } from "@/features/admin/components/admin-route-components";
import { loadCreationReferenceData } from "@/features/admin/lib/card-detail-prefetch";
import { deskCardPrintingsQueryOptions } from "@/features/admin/lib/printing-desk-queries";
import { printingPrefillSearchSchema } from "@/features/catalog-workspace/lib/workspace-search";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/workspace/printings/create")({
  validateSearch: printingPrefillSearchSchema,
  loaderDeps: ({ search }) => ({ card: search.card }),
  loader: async ({ context, deps, preload }) => {
    // The picked card's step shows its own loading state, so its printings are not awaited.
    if (!preload && deps.card !== undefined) {
      void Promise.allSettled([
        context.queryClient.query({
          ...deskCardPrintingsQueryOptions(deps.card),
          staleTime: "static",
        }),
      ]);
    }
    await loadCreationReferenceData(context.queryClient);
  },
  head: () => adminSeoHead("Create Printing"),
  pendingComponent: AdminPending,
});
