import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import { siDiscord } from "simple-icons";

import { PageHero } from "@/components/layout/page-hero";
import { BrandGlyph } from "@/components/ui/brand-glyph";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CardLink } from "@/components/ui/card-link";
import { TextLink } from "@/components/ui/text-link";
import { helpArticleLabels, visibleHelpArticles } from "@/features/marketing/components/articles";
import type { FeatureFlags } from "@/lib/feature-flags";
import { featureFlagsQueryOptions } from "@/lib/feature-flags";
import { SOCIAL_LINKS } from "@/lib/social-links";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function HelpIndexPage() {
  // Requires featureFlagsQueryOptions prefetched in the root loader, or this suspends during SSR.
  const { data: flags } = useSuspenseQuery(featureFlagsQueryOptions);
  const articles = visibleHelpArticles(flags as FeatureFlags);

  return (
    <>
      <PageHero
        title={m.help_index_heading()}
        lead={
          <>
            {m.help_index_missing_question()}{" "}
            <TextLink
              variant="inherit"
              className="text-foreground inline-flex items-baseline gap-1"
              href={SOCIAL_LINKS.discordInvite}
              target="_blank"
              rel="noreferrer"
            >
              <BrandGlyph
                icon={siDiscord}
                fallback={ExternalLinkIcon}
                className="size-3.5 self-center"
              />
              <span>{m.help_index_ask_on_discord()}</span>
            </TextLink>
          </>
        }
      />
      <div className={cn(PAGE_WIDTH.capped, "flex-1 pt-3", PAGE_PADDING_NO_TOP)}>
        <div className="grid gap-3 sm:grid-cols-2">
          {articles.map((article) => {
            const labels = helpArticleLabels(article);
            return (
              <CardLink
                key={article.slug}
                render={<Link to="/help/$slug" params={{ slug: article.slug }} />}
                size="sm"
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <article.icon className="text-muted-foreground size-4" />
                    {labels.title}
                  </CardTitle>
                  <CardDescription>{labels.description}</CardDescription>
                </CardHeader>
              </CardLink>
            );
          })}
        </div>
      </div>
    </>
  );
}
