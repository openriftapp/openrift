import { createFileRoute } from "@tanstack/react-router";

import { requireSession } from "@/lib/auth-session";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/contribute_/image")({
  beforeLoad: async ({ location, context }) => {
    await requireSession({ context, location });
  },
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Add a missing image",
      description:
        "Send in a photo for a Riftbound card printing that still shows a placeholder on OpenRift.",
      path: "/contribute/image",
    }),
});
