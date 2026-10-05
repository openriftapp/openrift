import { createLazyFileRoute } from "@tanstack/react-router";

import { DevelopersPage } from "@/features/marketing/components/developers-page";

export const Route = createLazyFileRoute("/_app/developers")({
  component: DevelopersPage,
});
