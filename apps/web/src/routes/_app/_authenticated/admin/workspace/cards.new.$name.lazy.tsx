import { createLazyFileRoute } from "@tanstack/react-router";

import { NewCardRecordPage } from "@/features/catalog-workspace/components/new-card-record-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/workspace/cards/new/$name")({
  component: NewCardRecordPage,
});
