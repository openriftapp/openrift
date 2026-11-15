import { createFileRoute } from "@tanstack/react-router";

import { requestInstallPlatform } from "@/lib/request-install-platform";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/install")({
  loader: () => ({ platform: requestInstallPlatform() }),
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Get the App",
      description:
        "Add OpenRift to your iPhone or Android home screen. It opens full screen like an app, with nothing to download from an app store.",
      path: "/install",
    }),
});
