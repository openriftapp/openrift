import { createLazyFileRoute } from "@tanstack/react-router";

import { CardmarketPicksImportPage } from "@/features/extension/components/cardmarket-picks-import-page";

export const Route = createLazyFileRoute(
  "/_app/_authenticated/collections/lists/import/cardmarket",
)({
  component: CardmarketPicksImportPage,
});
