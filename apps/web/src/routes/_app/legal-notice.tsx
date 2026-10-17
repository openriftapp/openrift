import { createFileRoute, notFound } from "@tanstack/react-router";

import { isOfficialInstance } from "@/lib/official-host";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/legal-notice")({
  beforeLoad: () => {
    if (!isOfficialInstance()) {
      throw notFound();
    }
  },
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Legal Notice",
      description: "Legal notice and imprint for OpenRift.",
      path: "/legal-notice",
    }),
});
