import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { requireScanner } from "@/features/scan/lib/scanner-flag";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/_authenticated/scan_/report")({
  // data-only: the journal it reports on lives in this device's localStorage.
  ssr: "data-only",
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "Scan report", noIndex: true }),
  beforeLoad: async ({ context }) => {
    await requireScanner(context.queryClient);
  },
  errorComponent: RouteErrorFallback,
});
