import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/mini";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import { workspaceSearchSchema } from "@/features/catalog-workspace/lib/workspace-search";
import { lenient } from "@/lib/lenient-param";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/workspace/printings")({
  head: () => adminSeoHead("Printings"),
  validateSearch: z.extend(workspaceSearchSchema, {
    desk: lenient(z.enum(["mine", "promos"])),
  }),
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
