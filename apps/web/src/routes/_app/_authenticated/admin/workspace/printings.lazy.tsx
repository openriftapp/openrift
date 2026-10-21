import { createLazyFileRoute } from "@tanstack/react-router";

import { PrintingsPage } from "@/features/catalog-workspace/components/printings-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/workspace/printings")({
  component: PrintingsPage,
});
