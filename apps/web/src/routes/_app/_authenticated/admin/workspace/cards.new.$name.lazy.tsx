import { createLazyFileRoute } from "@tanstack/react-router";

import { NewCardPassPage } from "@/features/catalog-workspace/components/pass/new-card-pass";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/workspace/cards/new/$name")({
  component: NewCardPassPage,
});
