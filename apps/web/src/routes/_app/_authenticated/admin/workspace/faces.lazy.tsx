import { createLazyFileRoute } from "@tanstack/react-router";

import { FacesPage } from "@/features/catalog-workspace/components/faces-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/workspace/faces")({
  component: FacesPage,
});
