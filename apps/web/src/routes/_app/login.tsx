import { createFileRoute } from "@tanstack/react-router";

import { redirectSignedIn } from "@/lib/auth-session";
import { randomEmailPlaceholder } from "@/lib/placeholders";
import { authSearchSchema } from "@/lib/route-search";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/login")({
  validateSearch: authSearchSchema,
  beforeLoad: redirectSignedIn,
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Log In",
      description: "Sign in to your OpenRift account.",
      path: "/login",
      noIndex: true,
    }),
  loader: () => ({ emailPlaceholder: randomEmailPlaceholder() }),
});
