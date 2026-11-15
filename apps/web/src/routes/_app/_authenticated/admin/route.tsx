import { createFileRoute } from "@tanstack/react-router";

import { requireAdminAccess } from "@/lib/admin-access-gate";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin")({
  ssr: false,
  staticData: { hideFooter: true },
  // Reruns on every /admin navigation, since grant holders are gated per section.
  beforeLoad: requireAdminAccess,
  head: () => privateSeoHead("Admin"),
});
