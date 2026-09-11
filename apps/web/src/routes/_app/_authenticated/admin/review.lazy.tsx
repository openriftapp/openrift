import { createLazyFileRoute } from "@tanstack/react-router";

import { ReviewInboxPage } from "@/features/admin/components/review-inbox-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/review")({
  component: ReviewInboxPage,
});
