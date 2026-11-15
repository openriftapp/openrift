import { createFileRoute } from "@tanstack/react-router";

import { NotFoundFallback } from "@/components/error-message";
import { requireFeature } from "@/lib/feature-flags";

export const Route = createFileRoute("/_app/_authenticated/admin/workspace")({
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "catalog-workspace"),
  notFoundComponent: NotFoundFallback,
});
