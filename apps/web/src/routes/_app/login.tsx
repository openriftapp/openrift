import { createFileRoute } from "@tanstack/react-router";

import { randomEmailPlaceholder } from "@/lib/placeholders";
import { authSearchSchema } from "@/lib/route-search";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/login")({
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Log In",
      description: "Sign in to your OpenRift account.",
      path: "/login",
      noIndex: true,
    }),
  validateSearch: authSearchSchema,
  loader: () => ({ emailPlaceholder: randomEmailPlaceholder() }),
});
