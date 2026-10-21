import { createLazyFileRoute } from "@tanstack/react-router";

import { PrintingRecordPage } from "@/features/catalog-workspace/components/printing-record-page";

export const Route = createLazyFileRoute(
  "/_app/_authenticated/admin/workspace/printings/$printingId",
)({
  component: PrintingRecordPage,
});
