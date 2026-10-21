import { createLazyFileRoute } from "@tanstack/react-router";

import { NewPrintingRecordPage } from "@/features/catalog-workspace/components/new-printing-record-page";

export const Route = createLazyFileRoute(
  "/_app/_authenticated/admin/workspace/printings/new/$candidatePrintingId",
)({
  component: NewPrintingRecordPage,
});
