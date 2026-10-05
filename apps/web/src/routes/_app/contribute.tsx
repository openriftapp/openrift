import { createFileRoute } from "@tanstack/react-router";

import { requireSession } from "@/lib/auth-session";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/contribute")({
  beforeLoad: async ({ location, context }) => {
    await requireSession({ context, location });
  },
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Contribute card data",
      description:
        "Submit a missing or corrected Riftbound card to OpenRift. Fill in what you know and send it for review, right from the app.",
      path: "/contribute",
    }),
});
