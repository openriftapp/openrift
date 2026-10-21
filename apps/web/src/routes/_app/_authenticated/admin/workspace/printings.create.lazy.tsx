import { createLazyFileRoute } from "@tanstack/react-router";

import { CreatePrintingPage } from "@/features/catalog-workspace/components/create-printing-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/workspace/printings/create")({
  component: CreatePrintingPage,
});
