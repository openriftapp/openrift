import { createLazyFileRoute } from "@tanstack/react-router";

import { Heading } from "@/components/heading";
import { PAGE_PADDING } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export const Route = createLazyFileRoute("/_app/promos")({
  component: PromosEmpty,
});

// Reached only when the dataset has no printings — the loader otherwise
// redirects to /promos/$language for the default language.
function PromosEmpty() {
  return (
    <div className={PAGE_PADDING}>
      <Heading level={1}>{m.promos_title()}</Heading>
      <p className="text-muted-foreground mt-2 text-sm">{m.promos_empty()}</p>
    </div>
  );
}
