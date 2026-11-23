import { createFileRoute } from "@tanstack/react-router";

import { AdminPending } from "@/features/admin/components/admin-route-components";
import { facesSearchSchema } from "@/features/catalog-workspace/lib/workspace-search";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/workspace/faces")({
  head: () => adminSeoHead("Faces"),
  validateSearch: facesSearchSchema,
  pendingComponent: AdminPending,
});
