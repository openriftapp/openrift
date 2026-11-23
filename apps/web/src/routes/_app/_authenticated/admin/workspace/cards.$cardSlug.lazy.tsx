import { createLazyFileRoute } from "@tanstack/react-router";

import { CardPassPage } from "@/features/catalog-workspace/components/pass/card-pass";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/workspace/cards/$cardSlug")({
  component: CardPassPage,
});
