import { createLazyFileRoute } from "@tanstack/react-router";

import { CardRecordPage } from "@/features/catalog-workspace/components/card-record-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/workspace/cards/$cardSlug")({
  component: CardRecordPage,
});
