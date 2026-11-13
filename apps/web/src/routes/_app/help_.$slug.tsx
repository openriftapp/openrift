import { createFileRoute, notFound } from "@tanstack/react-router";

import { NotFoundFallback } from "@/components/error-message";
import { helpArticles } from "@/features/marketing/components/articles";
import { requireFeature } from "@/lib/feature-flags";
import { articleJsonLd, breadcrumbJsonLd, privateSeoHead, seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

interface HelpArticleLoaderData {
  served: true;
}

export const Route = createFileRoute("/_app/help_/$slug")({
  loader: async ({ params, context }): Promise<HelpArticleLoaderData> => {
    const article = helpArticles.get(params.slug);
    if (!article) {
      throw notFound();
    }
    if (article.featureFlag) {
      await requireFeature(context.queryClient, article.featureFlag);
    }
    return { served: true };
  },
  head: ({ params, loaderData }) => {
    const siteUrl = getSiteUrl();
    const article = helpArticles.get(params.slug);
    if (!article || !(loaderData as HelpArticleLoaderData | undefined)?.served) {
      return privateSeoHead("Help");
    }
    const head = seoHead({
      siteUrl,
      title: `${article.title} - Help`,
      description: article.description,
      path: `/help/${params.slug}`,
    });
    const articlePath = `/help/${article.slug}`;
    return {
      ...head,
      scripts: [
        articleJsonLd({
          siteUrl,
          headline: article.title,
          description: article.description,
          path: articlePath,
        }),
        breadcrumbJsonLd(siteUrl, [
          { name: "Help", path: "/help" },
          { name: article.title, path: articlePath },
        ]),
      ],
    };
  },
  notFoundComponent: NotFoundFallback,
});
