import { createLazyFileRoute } from "@tanstack/react-router";

import { UnsubscribePage } from "@/features/account/components/unsubscribe-page";

export const Route = createLazyFileRoute("/unsubscribe")({
  component: UnsubscribePage,
});
