import { createLazyFileRoute } from "@tanstack/react-router";

import { ResetPasswordPage } from "@/features/account/components/reset-password-page";

export const Route = createLazyFileRoute("/_app/reset-password")({
  component: ResetPasswordPage,
});
