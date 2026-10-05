import { createFileRoute } from "@tanstack/react-router";

import { randomEmailPlaceholder } from "@/lib/placeholders";
import { authSearchSchema } from "@/lib/route-search";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/signup")({
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Sign Up",
      description:
        "Create a free OpenRift account to track your Riftbound card collection and build decks.",
      path: "/signup",
      noIndex: true,
    }),
  validateSearch: authSearchSchema,
  loader: () => ({ emailPlaceholder: randomEmailPlaceholder() }),
});
