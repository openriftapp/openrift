import { createFileRoute, notFound } from "@tanstack/react-router";

import { isOfficialInstance } from "@/lib/official-host";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/privacy-policy")({
  beforeLoad: () => {
    if (!isOfficialInstance()) {
      throw notFound();
    }
  },
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Privacy Policy",
      description: "How OpenRift handles your data, cookies, and privacy.",
      path: "/privacy-policy",
    }),
});
