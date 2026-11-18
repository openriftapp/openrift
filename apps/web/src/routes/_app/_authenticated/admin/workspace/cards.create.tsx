import { createFileRoute } from "@tanstack/react-router";

import { AdminPending } from "@/features/admin/components/admin-route-components";
import { loadCreationReferenceData } from "@/features/admin/lib/card-detail-prefetch";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/workspace/cards/create")({
  loader: async ({ context }) => {
    await loadCreationReferenceData(context.queryClient);
  },
  head: () => adminSeoHead("Create Card"),
  pendingComponent: AdminPending,
});
