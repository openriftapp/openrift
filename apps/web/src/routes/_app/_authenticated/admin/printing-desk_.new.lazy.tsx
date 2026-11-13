import { createLazyFileRoute } from "@tanstack/react-router";

import { PrintingDeskCreatePage } from "@/features/admin/components/printing-desk-form-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/printing-desk_/new")({
  component: PrintingDeskNewRoute,
});

function PrintingDeskNewRoute() {
  const { card } = Route.useSearch();
  return <PrintingDeskCreatePage cardSlug={card} />;
}
