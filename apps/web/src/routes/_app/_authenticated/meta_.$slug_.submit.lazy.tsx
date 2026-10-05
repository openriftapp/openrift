import { createLazyFileRoute } from "@tanstack/react-router";

import { MetaEventSubmitPage } from "@/features/meta/components/meta-event-submit-page";

export const Route = createLazyFileRoute("/_app/_authenticated/meta_/$slug_/submit")({
  component: MetaEventSubmitPage,
});
