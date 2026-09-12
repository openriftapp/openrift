import { Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import type { ComponentType } from "react";
import { Suspense, lazy } from "react";

import { Heading } from "@/components/heading";
import type { HelpArticle } from "@/lib/help-article";
import { cn, PAGE_PADDING, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { helpArticleLabels, helpArticles } from "./articles";

// lazy() must be called at module scope, not during render: calling it per
// render hands Suspense a new component each time and remounts the article.
const ARTICLE_CONTENT: Record<string, ComponentType> = Object.fromEntries(
  [...helpArticles].map(([slug, entry]) => [slug, lazy(entry.component)]),
);

export function HelpArticlePage({ article }: { article: HelpArticle }) {
  const ArticleContent = ARTICLE_CONTENT[article.slug];
  const { title } = helpArticleLabels(article);

  return (
    <div className={cn(PAGE_WIDTH.capped, "flex-1", PAGE_PADDING)}>
      <div className="mx-auto max-w-prose">
        <nav aria-label={m.help_breadcrumb_label()} className="mb-4">
          <ol className="text-muted-foreground flex items-center gap-1 text-sm">
            <li>
              <Link to="/help" className="hover:text-foreground transition-colors">
                {m.help_breadcrumb_help()}
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRightIcon className="size-3.5" />
            </li>
            <li>
              <span className="text-foreground" aria-current="page">
                {title}
              </span>
            </li>
          </ol>
        </nav>

        <Heading level={1} className="mb-6">
          {title}
        </Heading>

        <Suspense>{ArticleContent && <ArticleContent />}</Suspense>
      </div>
    </div>
  );
}
