import { createLazyFileRoute } from "@tanstack/react-router";

import { CreatePrintingPage } from "@/features/admin/components/create-printing-page";

export const Route = createLazyFileRoute(
  "/_app/_authenticated/admin/cards_/$cardSlug_/printings/create",
)({
  component: CreatePrintingPage,
});
