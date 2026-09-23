import { createLazyFileRoute } from "@tanstack/react-router";

import { InstallPage } from "@/features/marketing/components/install-page";

export const Route = createLazyFileRoute("/_app/install")({
  component: InstallPage,
});
