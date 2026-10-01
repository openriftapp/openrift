import { createLazyFileRoute } from "@tanstack/react-router";

import { ErrataPage } from "@/features/cards/components/errata-page";

export const Route = createLazyFileRoute("/_app/errata")({
  component: ErrataPage,
});
