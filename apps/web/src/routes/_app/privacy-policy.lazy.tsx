import { createLazyFileRoute } from "@tanstack/react-router";

import { PrivacyPolicyPage } from "@/features/marketing/components/privacy-policy-page";

export const Route = createLazyFileRoute("/_app/privacy-policy")({
  component: PrivacyPolicyPage,
});
