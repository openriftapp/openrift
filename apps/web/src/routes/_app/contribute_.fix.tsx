import { createFileRoute } from "@tanstack/react-router";

import { requireSession } from "@/lib/auth-session";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/contribute_/fix")({
  beforeLoad: async ({ location, context }) => {
    await requireSession({ context, location });
  },
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Fix something on a card",
      description:
        "Suggest a correction to a Riftbound card on OpenRift. Pick the card, then tell us what is wrong.",
      path: "/contribute/fix",
    }),
});
