import type { LucideIcon } from "lucide-react";
import {
  ArrowDownUpIcon,
  BookOpenIcon,
  BoxIcon,
  FlaskConicalIcon,
  GitBranchIcon,
  HandHeartIcon,
  LayersIcon,
  LayoutGridIcon,
  LibraryIcon,
  ListChecksIcon,
  ListOrderedIcon,
  MessageSquareIcon,
  MonitorPlayIcon,
  PaintbrushIcon,
  ScanLineIcon,
  Share2Icon,
  SparklesIcon,
  SwordsIcon,
  TicketIcon,
  TrendingUpIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react";

import { getDomainColor } from "@/lib/domain";
import { m } from "@/paraglide/messages.js";

interface ChapterFeatureLink {
  /** Without the `#`. */
  hash: string;
  label: string;
  icon: LucideIcon;
}

export interface FeatureChapter {
  id: string;
  number: string;
  title: string;
  tagline: string;
  glowColor: string;
  icon: LucideIcon;
  features: ChapterFeatureLink[];
}

export function chapterAnchor(id: string): string {
  return `chapter-${id}`;
}

export function featureChapters(): FeatureChapter[] {
  return [
    {
      id: "collect",
      number: "01",
      title: m.marketing_chapter_collect_title(),
      tagline: m.marketing_chapter_collect_tagline(),
      glowColor: getDomainColor("order"),
      icon: LibraryIcon,
      features: [
        { hash: "catalog", label: m.marketing_chapter_feature_catalog(), icon: LayoutGridIcon },
        { hash: "import", label: m.marketing_chapter_feature_import(), icon: ArrowDownUpIcon },
        { hash: "scan", label: m.marketing_chapter_feature_scan(), icon: ScanLineIcon },
        {
          hash: "collections",
          label: m.marketing_chapter_feature_collections(),
          icon: LibraryIcon,
        },
        { hash: "lists", label: m.marketing_chapter_feature_lists(), icon: ListChecksIcon },
        { hash: "prices", label: m.marketing_chapter_feature_prices(), icon: TrendingUpIcon },
        { hash: "promos", label: m.marketing_chapter_feature_promos(), icon: TicketIcon },
      ],
    },
    {
      id: "build",
      number: "02",
      title: m.marketing_chapter_build_title(),
      tagline: m.marketing_chapter_build_tagline(),
      glowColor: getDomainColor("mind"),
      icon: LayersIcon,
      features: [
        { hash: "decks", label: m.marketing_chapter_feature_decks(), icon: LayersIcon },
        { hash: "variants", label: m.marketing_chapter_feature_variants(), icon: GitBranchIcon },
        { hash: "test", label: m.marketing_chapter_feature_test(), icon: FlaskConicalIcon },
        { hash: "box", label: m.marketing_chapter_feature_box(), icon: BoxIcon },
      ],
    },
    {
      id: "play",
      number: "03",
      title: m.marketing_chapter_play_title(),
      tagline: m.marketing_chapter_play_tagline(),
      glowColor: getDomainColor("fury"),
      icon: TrophyIcon,
      features: [
        { hash: "tournaments", label: m.marketing_chapter_feature_tournaments(), icon: TrophyIcon },
        { hash: "rules", label: m.marketing_chapter_feature_rules(), icon: BookOpenIcon },
        { hash: "tracker", label: m.marketing_chapter_feature_tracker(), icon: SwordsIcon },
      ],
    },
    {
      id: "community",
      number: "04",
      title: m.marketing_chapter_community_title(),
      tagline: m.marketing_chapter_community_tagline(),
      glowColor: getDomainColor("calm"),
      icon: UsersIcon,
      features: [
        { hash: "groups", label: m.marketing_chapter_feature_groups(), icon: UsersIcon },
        {
          hash: "trade-match",
          label: m.marketing_chapter_feature_trade_match(),
          icon: ArrowDownUpIcon,
        },
        { hash: "loans", label: m.marketing_chapter_feature_loans(), icon: HandHeartIcon },
        { hash: "share", label: m.marketing_chapter_feature_share(), icon: Share2Icon },
        { hash: "discord", label: m.marketing_chapter_feature_discord(), icon: MessageSquareIcon },
      ],
    },
    {
      id: "create",
      number: "05",
      title: m.marketing_chapter_create_title(),
      tagline: m.marketing_chapter_create_tagline(),
      glowColor: getDomainColor("chaos"),
      icon: SparklesIcon,
      features: [
        { hash: "stage", label: m.marketing_chapter_feature_stage(), icon: MonitorPlayIcon },
        {
          hash: "tier-lists",
          label: m.marketing_chapter_feature_tier_lists(),
          icon: ListOrderedIcon,
        },
        {
          hash: "chat-lookups",
          label: m.marketing_chapter_feature_chat_lookups(),
          icon: MessageSquareIcon,
        },
        { hash: "designer", label: m.marketing_chapter_feature_designer(), icon: PaintbrushIcon },
      ],
    },
  ];
}
