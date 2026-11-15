import { createFileRoute } from "@tanstack/react-router";

import { AdminPending } from "@/features/admin/components/admin-route-components";
import { adminArtVariantsQueryOptions } from "@/features/admin/lib/art-variants-queries";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/art-variants")({
  head: () => adminSeoHead("Art Variants"),
  loader: ({ context }) =>
    context.queryClient.query({ ...adminArtVariantsQueryOptions, staleTime: "static" }),
  pendingComponent: AdminPending,
});
