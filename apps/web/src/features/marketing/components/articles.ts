import {
  ArrowRightLeftIcon,
  BookOpenIcon,
  BotIcon,
  HeartIcon,
  LayersIcon,
  LibraryIcon,
  ListOrderedIcon,
  MessageSquareIcon,
  MonitorPlayIcon,
  PrinterIcon,
  PuzzleIcon,
  ScaleIcon,
  SearchIcon,
  SwordsIcon,
  UsersIcon,
  WebhookIcon,
} from "lucide-react";

import type { FeatureFlags } from "@/lib/feature-flags";
import { featureEnabled } from "@/lib/feature-flags";
import type { HelpArticle } from "@/lib/help-article";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";

export const helpArticles = new Map<string, HelpArticle>([
  [
    "why-openrift",
    {
      slug: "why-openrift",
      labels: (options) => ({
        title: m.help_article_why_openrift_title({}, options),
        description: m.help_article_why_openrift_description({}, options),
      }),
      icon: ScaleIcon,
      component: () => import("@/features/marketing/components/articles/why-openrift"),
    },
  ],
  [
    "how-to-play",
    {
      slug: "how-to-play",
      labels: (options) => ({
        title: m.help_article_how_to_play_title({}, options),
        description: m.help_article_how_to_play_description({}, options),
      }),
      icon: BookOpenIcon,
      component: () => import("@/features/marketing/components/articles/how-to-play"),
      featureFlag: "help-how-to-play",
    },
  ],
  [
    "cards-printings-copies",
    {
      slug: "cards-printings-copies",
      labels: (options) => ({
        title: m.help_article_cards_printings_copies_title({}, options),
        description: m.help_article_cards_printings_copies_description({}, options),
      }),
      icon: LayersIcon,
      component: () => import("@/features/marketing/components/articles/cards-printings-copies"),
    },
  ],
  [
    "search-syntax",
    {
      slug: "search-syntax",
      labels: (options) => ({
        title: m.help_article_search_syntax_title({}, options),
        description: m.help_article_search_syntax_description({}, options),
      }),
      icon: SearchIcon,
      component: () => import("@/features/marketing/components/articles/search-syntax"),
    },
  ],
  [
    "collections",
    {
      slug: "collections",
      labels: (options) => ({
        title: m.help_article_collections_title({}, options),
        description: m.help_article_collections_description({}, options),
      }),
      icon: LibraryIcon,
      component: () => import("@/features/marketing/components/articles/collections"),
    },
  ],
  [
    "import-export",
    {
      slug: "import-export",
      labels: (options) => ({
        title: m.help_article_import_export_title({}, options),
        description: m.help_article_import_export_description({}, options),
      }),
      icon: ArrowRightLeftIcon,
      component: () => import("@/features/marketing/components/articles/import-export"),
    },
  ],
  [
    "browser-extension",
    {
      slug: "browser-extension",
      labels: (options) => ({
        title: m.help_article_browser_extension_title({}, options),
        description: m.help_article_browser_extension_description({}, options),
      }),
      icon: PuzzleIcon,
      component: () => import("@/features/marketing/components/articles/browser-extension"),
    },
  ],
  [
    "lists",
    {
      slug: "lists",
      labels: (options) => ({
        title: m.help_article_lists_title({}, options),
        description: m.help_article_lists_description({}, options),
      }),
      icon: HeartIcon,
      component: () => import("@/features/marketing/components/articles/lists"),
    },
  ],
  [
    "groups",
    {
      slug: "groups",
      labels: (options) => ({
        title: m.help_article_groups_title({}, options),
        description: m.help_article_groups_description({}, options),
      }),
      icon: UsersIcon,
      component: () => import("@/features/marketing/components/articles/groups"),
    },
  ],
  [
    "deck-building",
    {
      slug: "deck-building",
      labels: (options) => ({
        title: m.help_article_deck_building_title({}, options),
        description: m.help_article_deck_building_description({}, options),
      }),
      icon: SwordsIcon,
      component: () => import("@/features/marketing/components/articles/deck-building"),
    },
  ],
  [
    "proxy-printing",
    {
      slug: "proxy-printing",
      labels: (options) => ({
        title: m.help_article_proxy_printing_title({}, options),
        description: m.help_article_proxy_printing_description({}, options),
      }),
      icon: PrinterIcon,
      component: () => import("@/features/marketing/components/articles/proxy-printing"),
    },
  ],
  [
    "discord-bot",
    {
      slug: "discord-bot",
      labels: (options) => ({
        title: m.help_article_discord_bot_title({}, options),
        description: m.help_article_discord_bot_description({}, options),
      }),
      icon: BotIcon,
      component: () => import("@/features/marketing/components/articles/discord-bot"),
    },
  ],
  [
    "stage",
    {
      slug: "stage",
      labels: (options) => ({
        title: m.help_article_stage_title({}, options),
        description: m.help_article_stage_description({}, options),
      }),
      icon: MonitorPlayIcon,
      component: () => import("@/features/marketing/components/articles/stage"),
    },
  ],
  [
    "tier-lists",
    {
      slug: "tier-lists",
      labels: (options) => ({
        title: m.help_article_tier_lists_title({}, options),
        description: m.help_article_tier_lists_description({}, options),
      }),
      icon: ListOrderedIcon,
      component: () => import("@/features/marketing/components/articles/tier-lists"),
    },
  ],
  [
    "chat-commands",
    {
      slug: "chat-commands",
      labels: (options) => ({
        title: m.help_article_chat_commands_title({}, options),
        description: m.help_article_chat_commands_description({}, options),
      }),
      icon: MessageSquareIcon,
      component: () => import("@/features/marketing/components/articles/chat-commands"),
    },
  ],
  [
    "tournament-decklist-api",
    {
      slug: "tournament-decklist-api",
      labels: (options) => ({
        title: m.help_article_tournament_decklist_api_title({}, options),
        description: m.help_article_tournament_decklist_api_description({}, options),
      }),
      icon: WebhookIcon,
      component: () => import("@/features/marketing/components/articles/tournament-decklist-api"),
    },
  ],
]);

export function helpArticleLabels(
  article: HelpArticle,
  options?: { locale?: Locale },
): { title: string; description: string } {
  return article.labels(options);
}

export const helpArticleList = [...helpArticles.values()];

/**
 * Every article-listing surface must filter through this, not on the raw
 * presence of `featureFlag`, or an article stays hidden after its flag ships.
 */
export function visibleHelpArticles(flags: FeatureFlags): HelpArticle[] {
  return helpArticleList.filter(
    (article) => !article.featureFlag || featureEnabled(flags, article.featureFlag),
  );
}
