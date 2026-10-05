import { createFileRoute } from "@tanstack/react-router";

import { requireSession } from "@/lib/auth-session";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/contribute_/card")({
  beforeLoad: async ({ location, context }) => {
    await requireSession({ context, location });
  },
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Add a card",
      description:
        "Submit a missing Riftbound card to OpenRift. Fill in what you know and send it for review, right from the app.",
      path: "/contribute/card",
    }),
});
