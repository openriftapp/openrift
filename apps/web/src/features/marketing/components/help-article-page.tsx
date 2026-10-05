import { Link } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { Suspense, lazy } from "react";

import { TopBarBreadcrumbBar } from "@/components/layout/top-bar-breadcrumb";
import { helpArticleLabels, helpArticles } from "@/features/marketing/components/articles";
import type { HelpArticle } from "@/lib/help-article";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

// lazy() must be called at module scope, not during render: calling it per
// render hands Suspense a new component each time and remounts the article.
const ARTICLE_CONTENT: Record<string, ComponentType> = Object.fromEntries(
  [...helpArticles].map(([slug, entry]) => [slug, lazy(entry.component)]),
);

export function HelpArticlePage({ article }: { article: HelpArticle }) {
  const ArticleContent = ARTICLE_CONTENT[article.slug];
  const { title } = helpArticleLabels(article);

  return (
    <>
      <TopBarBreadcrumbBar
        segments={[{ label: m.help_breadcrumb_help(), link: <Link to="/help" /> }]}
        title={title}
      />
      <div className={cn(PAGE_WIDTH.capped, "flex-1 pt-3", PAGE_PADDING_NO_TOP)}>
        <div className="mx-auto max-w-prose">
          <Suspense>{ArticleContent && <ArticleContent />}</Suspense>
        </div>
      </div>
    </>
  );
}
