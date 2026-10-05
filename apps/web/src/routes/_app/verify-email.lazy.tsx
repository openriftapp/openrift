import { createLazyFileRoute } from "@tanstack/react-router";

import { VerifyEmailPage } from "@/features/account/components/verify-email-page";

export const Route = createLazyFileRoute("/_app/verify-email")({
  component: VerifyEmailPage,
});
