import { createFileRoute } from "@tanstack/react-router";

import { redirectSignedIn } from "@/lib/auth-session";
import { randomEmailPlaceholder } from "@/lib/placeholders";
import { authSearchSchema } from "@/lib/route-search";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/signup")({
  validateSearch: authSearchSchema,
  beforeLoad: redirectSignedIn,
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Sign Up",
      description:
        "Create a free OpenRift account to track your Riftbound card collection and build decks.",
      path: "/signup",
      noIndex: true,
    }),
  loader: () => ({ emailPlaceholder: randomEmailPlaceholder() }),
});
