import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { siDiscord } from "simple-icons";

import { Heading } from "@/components/heading";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CardLink } from "@/components/ui/card-link";
import { TextLink } from "@/components/ui/text-link";
import type { FeatureFlags } from "@/lib/feature-flags";
import { featureFlagsQueryOptions } from "@/lib/feature-flags";
import { SOCIAL_LINKS } from "@/lib/social-links";
import { cn, PAGE_PADDING, PAGE_WIDTH } from "@/lib/utils";

import { visibleHelpArticles } from "./articles";

export function HelpIndexPage() {
  // Requires featureFlagsQueryOptions prefetched in the root loader, or this suspends during SSR.
  const { data: flags } = useSuspenseQuery(featureFlagsQueryOptions);
  const articles = visibleHelpArticles(flags as FeatureFlags);

  return (
    <div className={cn(PAGE_WIDTH.capped, "flex-1", PAGE_PADDING)}>
      <div className="mb-6">
        <Heading level={1}>Help Center</Heading>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {articles.map((article) => (
          <CardLink
            key={article.slug}
            render={<Link to="/help/$slug" params={{ slug: article.slug }} />}
            size="sm"
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <article.icon className="text-muted-foreground size-4" />
                {article.title}
              </CardTitle>
              <CardDescription>{article.description}</CardDescription>
            </CardHeader>
          </CardLink>
        ))}
      </div>

      <div className="text-muted-foreground mt-8">
        <p>
          Can&apos;t find what you&apos;re looking for?{" "}
          <TextLink
            variant="inherit"
            className="text-foreground inline-flex items-baseline gap-1"
            href={SOCIAL_LINKS.discordInvite}
            target="_blank"
            rel="noreferrer"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-3.5 self-center fill-current"
              aria-hidden="true"
            >
              <path d={siDiscord.path} />
            </svg>
            <span>Ask on Discord</span>
          </TextLink>
        </p>
      </div>
    </div>
  );
}
