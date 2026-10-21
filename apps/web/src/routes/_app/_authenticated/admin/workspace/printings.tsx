/* oxlint-disable unicorn/no-useless-undefined, promise/prefer-await-to-then, unicorn/prefer-top-level-await -- zod's `.catch(undefined)` is a sync fallback, not a Promise#catch */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import { workspaceSearchSchema } from "@/features/catalog-workspace/lib/workspace-search";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/workspace/printings")({
  head: () => adminSeoHead("Printings"),
  validateSearch: workspaceSearchSchema.extend({
    desk: z.enum(["mine", "promos"]).optional().catch(undefined),
  }),
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
