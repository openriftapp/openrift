import { createLazyFileRoute, useParams } from "@tanstack/react-router";

import { PrintingPage } from "@/features/admin/components/printing-page";

function PrintingRoute() {
  const { printingId } = useParams({ from: "/_app/_authenticated/admin/printings/$printingId" });
  return <PrintingPage key={printingId} printingId={printingId} />;
}

export const Route = createLazyFileRoute("/_app/_authenticated/admin/printings/$printingId")({
  component: PrintingRoute,
});
