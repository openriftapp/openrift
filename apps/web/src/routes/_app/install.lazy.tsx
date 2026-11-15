import { createLazyFileRoute } from "@tanstack/react-router";

import { InstallPage } from "@/features/marketing/components/install-page";

export const Route = createLazyFileRoute("/_app/install")({
  component: InstallRoute,
});

function InstallRoute() {
  const { platform } = Route.useLoaderData();
  return <InstallPage initialPlatform={platform} />;
}
