import { createLazyFileRoute } from "@tanstack/react-router";

import { LegalNoticePage } from "@/features/marketing/components/legal-notice-page";

export const Route = createLazyFileRoute("/_app/legal-notice")({
  component: LegalNoticePage,
});
