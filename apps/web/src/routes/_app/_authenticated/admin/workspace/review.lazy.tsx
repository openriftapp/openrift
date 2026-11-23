import { createLazyFileRoute } from "@tanstack/react-router";

import { ReviewPage } from "@/features/catalog-workspace/components/review-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/workspace/review")({
  component: ReviewPage,
});
