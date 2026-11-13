import { createLazyFileRoute } from "@tanstack/react-router";

import { PrintingPage } from "@/features/admin/components/printing-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/printings/$printingId")({
  component: PrintingRoute,
});

function PrintingRoute() {
  const { printingId } = Route.useParams();
  return <PrintingPage key={printingId} printingId={printingId} />;
}
