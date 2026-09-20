import { createFileRoute } from "@tanstack/react-router";

import { filterSearchSchema } from "@/features/cards/lib/search-schemas";

export const Route = createFileRoute("/_app/_authenticated/collections")({
  ssr: false,
  staticData: { hideFooter: true },
  validateSearch: filterSearchSchema,
});
