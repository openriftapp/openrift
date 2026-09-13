import { createFileRoute } from "@tanstack/react-router";

import { changelogSearchSchema } from "@/features/marketing/lib/changelog-search-schema";
import { articleJsonLd, seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

const CHANGELOG_DESCRIPTION =
  "Every milestone and update OpenRift has shipped, and how to shape what comes next.";

export const Route = createFileRoute("/_app/changelog")({
  validateSearch: changelogSearchSchema,
  head: () => {
    const siteUrl = getSiteUrl();
    const head = seoHead({
      siteUrl,
      title: "Changelog",
      description: CHANGELOG_DESCRIPTION,
      path: "/changelog",
    });
    return {
      ...head,
      scripts: [
        articleJsonLd({
          siteUrl,
          headline: "OpenRift Changelog",
          description: CHANGELOG_DESCRIPTION,
          path: "/changelog",
        }),
      ],
    };
  },
});
