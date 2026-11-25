import { createFileRoute } from "@tanstack/react-router";

import { AdminPending } from "@/features/admin/components/admin-route-components";
import { loadRecordReferenceData } from "@/features/admin/lib/card-detail-prefetch";
import { deskPrintingQueryOptions } from "@/features/admin/lib/printing-desk-queries";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/workspace/printings/$printingId")({
  loader: async ({ context, params, preload }) => {
    if (!preload) {
      void Promise.allSettled([
        context.queryClient.query({
          ...deskPrintingQueryOptions(params.printingId, 1),
          staleTime: "static",
        }),
      ]);
    }
    await loadRecordReferenceData(context.queryClient);
  },
  head: () => adminSeoHead("Printing"),
  pendingComponent: AdminPending,
});
