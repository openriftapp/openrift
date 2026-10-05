import { createLazyFileRoute } from "@tanstack/react-router";

import { ErrorTestPage } from "@/features/admin/components/error-test-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/error-test")({
  component: ErrorTestPage,
});
