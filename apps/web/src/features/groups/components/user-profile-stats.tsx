import type { PublicUserProfileStats } from "@openrift/shared/types/api/user-share";
import { FolderIcon, LayersIcon, PenLineIcon, TrophyIcon } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { StatFigure } from "@/components/ui/stat-figure";
import { bestFinishHint, contributionsHint } from "@/features/groups/lib/user-profile-copy";
import { formatCount } from "@/lib/format";
import { m } from "@/paraglide/messages.js";

interface StatEntry {
  key: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: number;
  hint: string | null;
}

/** Zero counts are left out; a profile with nothing to count shows no strip at all. */
export function UserProfileStats({ stats }: { stats: PublicUserProfileStats }) {
  const entries: StatEntry[] = [];
  if (stats.collection !== null && stats.collection.copies > 0) {
    entries.push({
      key: "collection",
      icon: LayersIcon,
      label: m.user_profile_stat_collection(),
      value: stats.collection.copies,
      hint: m.user_profile_unique_cards({ count: stats.collection.uniqueCards }),
    });
  }
  if (stats.contributions.total > 0) {
    entries.push({
      key: "contributions",
      icon: PenLineIcon,
      label: m.user_profile_stat_contributions(),
      value: stats.contributions.total,
      hint: contributionsHint(stats.contributions),
    });
  }
  if (stats.tournaments.played > 0) {
    entries.push({
      key: "tournaments",
      icon: TrophyIcon,
      label: m.user_profile_stat_tournaments(),
      value: stats.tournaments.played,
      hint: bestFinishHint(stats.tournaments.bestFinish),
    });
  }
  if (stats.decks.total > 0) {
    entries.push({
      key: "decks",
      icon: FolderIcon,
      label: m.user_profile_stat_decks(),
      value: stats.decks.total,
      hint: stats.decks.topLegend
        ? m.user_profile_mostly_legend({ name: stats.decks.topLegend.name })
        : null,
    });
  }
  if (entries.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-x-10 gap-y-4">
      {entries.map((entry) => (
        <StatFigure
          key={entry.key}
          icon={entry.icon}
          value={formatCount(entry.value)}
          label={entry.label}
        >
          {entry.hint ? <span className="text-muted-foreground text-xs">{entry.hint}</span> : null}
        </StatFigure>
      ))}
    </div>
  );
}
