import { createFileRoute, notFound } from "@tanstack/react-router";

import { NotFoundFallback } from "@/components/error-message";
import { helpArticleLabels, helpArticles } from "@/features/marketing/components/articles";
import { requireFeature } from "@/lib/feature-flags";
import { initQueryOptions } from "@/lib/init-queries";
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
    await context.queryClient.query({ ...initQueryOptions, staleTime: "static" });
    return { served: true };
  },
  head: ({ params, loaderData }) => {
    const siteUrl = getSiteUrl();
    const article = helpArticles.get(params.slug);
    if (!article || !(loaderData as HelpArticleLoaderData | undefined)?.served) {
      return privateSeoHead("Help");
    }
    const { title, description } = helpArticleLabels(article, { locale: "en" });
    const head = seoHead({
      siteUrl,
      title: `${title} - Help`,
      description,
      path: `/help/${params.slug}`,
    });
    const articlePath = `/help/${article.slug}`;
    return {
      ...head,
      scripts: [
        articleJsonLd({
          siteUrl,
          headline: title,
          description,
          path: articlePath,
        }),
        breadcrumbJsonLd(siteUrl, [
          { name: "Help", path: "/help" },
          { name: title, path: articlePath },
        ]),
      ],
    };
  },
  notFoundComponent: NotFoundFallback,
});
