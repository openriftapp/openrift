import { createFileRoute } from "@tanstack/react-router";

import { authSearchSchema } from "@/lib/route-search";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/verify-email")({
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Verify Email",
      path: "/verify-email",
      noIndex: true,
    }),
  validateSearch: (search: Record<string, unknown>) => {
    const { redirect, email } = authSearchSchema(search);
    return { redirect, email: email ?? "" };
  },
});
