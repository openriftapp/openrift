import { getRouteApi } from "@tanstack/react-router";

import { NewPrintingRecord } from "@/features/catalog-workspace/components/new-printing-record";

const routeApi = getRouteApi(
  "/_app/_authenticated/admin/workspace/printings/new/$candidatePrintingId",
);

export function NewPrintingRecordPage() {
  const { candidatePrintingId } = routeApi.useParams();
  return <NewPrintingRecord key={candidatePrintingId} candidatePrintingId={candidatePrintingId} />;
}
