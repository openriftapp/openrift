import { createLazyFileRoute } from "@tanstack/react-router";

import { PrintingDeskCardPage } from "@/features/admin/components/printing-desk-card-page";

export const Route = createLazyFileRoute(
  "/_app/_authenticated/admin/printing-desk_/cards/$cardSlug",
)({
  component: PrintingDeskCardRoute,
});

function PrintingDeskCardRoute() {
  const { cardSlug } = Route.useParams();
  return <PrintingDeskCardPage cardSlug={cardSlug} />;
}
