import { createFileRoute } from "@tanstack/react-router";

import { redirectLegacyCompareSides } from "@/lib/deck-compare-gate";

export const Route = createFileRoute("/_app/decks")({
  // The comparison renders only in the browser, so its own redirect would
  // run after the server HTML is already on screen.
  beforeLoad: ({ location }) => {
    redirectLegacyCompareSides(location);
  },
});
