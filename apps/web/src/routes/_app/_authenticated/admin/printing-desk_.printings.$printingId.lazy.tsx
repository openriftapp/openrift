import { createLazyFileRoute, useParams, useSearch } from "@tanstack/react-router";

import { PrintingDeskPrintingPage } from "@/features/admin/components/printing-desk-printing-page";

function PrintingDeskPrintingRoute() {
  const { printingId } = useParams({
    from: "/_app/_authenticated/admin/printing-desk_/printings/$printingId",
  });
  const { side } = useSearch({
    from: "/_app/_authenticated/admin/printing-desk_/printings/$printingId",
  });
  return <PrintingDeskPrintingPage printingId={printingId} side={side ?? 1} />;
}

export const Route = createLazyFileRoute(
  "/_app/_authenticated/admin/printing-desk_/printings/$printingId",
)({
  component: PrintingDeskPrintingRoute,
});
