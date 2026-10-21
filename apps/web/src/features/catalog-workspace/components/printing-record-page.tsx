import { getRouteApi } from "@tanstack/react-router";

import { PrintingRecord } from "@/features/catalog-workspace/components/printing-record";

const routeApi = getRouteApi("/_app/_authenticated/admin/workspace/printings/$printingId");

export function PrintingRecordPage() {
  const { printingId } = routeApi.useParams();
  return <PrintingRecord key={printingId} printingId={printingId} />;
}
