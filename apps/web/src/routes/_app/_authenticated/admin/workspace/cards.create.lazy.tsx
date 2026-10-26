import { createLazyFileRoute } from "@tanstack/react-router";

import { NewManualCardRecord } from "@/features/catalog-workspace/components/new-manual-card-record";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/workspace/cards/create")({
  component: NewManualCardRecord,
});
