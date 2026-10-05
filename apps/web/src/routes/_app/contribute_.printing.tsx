import { createFileRoute } from "@tanstack/react-router";

import { requireSession } from "@/lib/auth-session";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/contribute_/printing")({
  beforeLoad: async ({ location, context }) => {
    await requireSession({ context, location });
  },
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Add a printing",
      description:
        "Add a missing printing of a Riftbound card to OpenRift. Pick the card, then describe the version you have.",
      path: "/contribute/printing",
    }),
});
