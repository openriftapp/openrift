import { createFileRoute } from "@tanstack/react-router";

import { preferencesQueryOptions } from "@/features/account/lib/preferences-queries";
import { adminAccessQueryOptions } from "@/features/admin/lib/admin-queries";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/_authenticated/profile")({
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "Profile", noIndex: true }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.query({
        ...adminAccessQueryOptions(context.userId),
        staleTime: "static",
      }),
      context.queryClient.query({
        ...preferencesQueryOptions(context.userId),
        staleTime: "static",
      }),
    ]);
  },
});
