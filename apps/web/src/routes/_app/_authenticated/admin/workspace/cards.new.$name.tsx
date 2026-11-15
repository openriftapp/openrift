import { createFileRoute } from "@tanstack/react-router";

import { AdminPending } from "@/features/admin/components/admin-route-components";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/workspace/cards/new/$name")({
  head: () => adminSeoHead("New Card"),
  pendingComponent: AdminPending,
});
