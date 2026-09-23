import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/install")({
  ssr: "data-only",
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Get the App",
      description:
        "Add OpenRift to your iPhone or Android home screen. It opens full screen like an app, with nothing to download from an app store.",
      path: "/install",
    }),
  errorComponent: RouteErrorFallback,
});
