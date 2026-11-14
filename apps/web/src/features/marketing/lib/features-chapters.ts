import type { LucideIcon } from "lucide-react";
import { LayersIcon, LibraryIcon, SparklesIcon, TrophyIcon, UsersIcon } from "lucide-react";

import { getDomainColor } from "@/lib/domain";
import { m } from "@/paraglide/messages.js";

export interface FeatureChapter {
  id: string;
  number: string;
  title: string;
  tagline: string;
  glowColor: string;
  icon: LucideIcon;
  features: string[];
}

export function chapterAnchor(id: string): string {
  return `chapter-${id}`;
}

export function featureChapters({ scanner }: { scanner: boolean }): FeatureChapter[] {
  return [
    {
      id: "collect",
      number: "01",
      title: m.marketing_chapter_collect_title(),
      tagline: m.marketing_chapter_collect_tagline(),
      glowColor: getDomainColor("order"),
      icon: LibraryIcon,
      features: [
        m.marketing_chapter_feature_catalog(),
        m.marketing_chapter_feature_import(),
        ...(scanner ? [m.marketing_chapter_feature_scan()] : []),
        m.marketing_chapter_feature_collections(),
        m.marketing_chapter_feature_lists(),
        m.marketing_chapter_feature_prices(),
        m.marketing_chapter_feature_promos(),
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
        m.marketing_chapter_feature_decks(),
        m.marketing_chapter_feature_variants(),
        m.marketing_chapter_feature_test(),
        m.marketing_chapter_feature_box(),
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
        m.marketing_chapter_feature_tournaments(),
        m.marketing_chapter_feature_rules(),
        m.marketing_chapter_feature_tracker(),
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
        m.marketing_chapter_feature_groups(),
        m.marketing_chapter_feature_trade_match(),
        m.marketing_chapter_feature_loans(),
        m.marketing_chapter_feature_share(),
        m.marketing_chapter_feature_discord(),
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
        m.marketing_chapter_feature_stage(),
        m.marketing_chapter_feature_tier_lists(),
        m.marketing_chapter_feature_chat_lookups(),
        m.marketing_chapter_feature_designer(),
      ],
    },
  ];
}
