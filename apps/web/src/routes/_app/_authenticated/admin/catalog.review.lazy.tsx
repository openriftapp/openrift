import { createLazyFileRoute } from "@tanstack/react-router";

import { ReviewInboxPage } from "@/features/catalog-admin/components/review-inbox-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/catalog/review")({
  component: ReviewInboxPage,
});
