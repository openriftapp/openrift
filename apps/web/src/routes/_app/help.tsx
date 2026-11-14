import { createFileRoute } from "@tanstack/react-router";

import { helpArticleLabels, visibleHelpArticles } from "@/features/marketing/components/articles";
import { featureFlagsQueryOptions } from "@/lib/feature-flags";
import { faqPageJsonLd, seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/help")({
  loader: async ({ context }) => {
    const flags = await context.queryClient.query({
      ...featureFlagsQueryOptions,
      staleTime: "static",
    });
    return {
      articles: visibleHelpArticles(flags).map((article) =>
        helpArticleLabels(article, { locale: "en" }),
      ),
    };
  },
  head: ({ loaderData }) => ({
    ...seoHead({
      siteUrl: getSiteUrl(),
      title: "Help",
      description:
        "Guides and frequently asked questions for OpenRift, including collection management, deck building, and import/export.",
      path: "/help",
    }),
    scripts: [
      faqPageJsonLd(
        (loaderData?.articles ?? []).map((a) => ({ question: a.title, answer: a.description })),
      ),
    ],
  }),
});
