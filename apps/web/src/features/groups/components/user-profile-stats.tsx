import type { PublicUserProfileStats } from "@openrift/shared/types/api/user-share";
import { FolderIcon, LayersIcon, PenLineIcon, TrophyIcon } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { Card } from "@/components/ui/card";
import type { IconChipTone } from "@/components/ui/icon-chip";
import { IconChip } from "@/components/ui/icon-chip";
import { bestFinishHint, contributionsHint } from "@/features/groups/lib/user-profile-copy";
import { m } from "@/paraglide/messages.js";

interface StatEntry {
  key: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: IconChipTone;
  label: string;
  value: number;
  hint: string | null;
}

function ProfileStat({ icon, tone, label, value, hint }: Omit<StatEntry, "key">) {
  return (
    <Card className="gap-4 p-5">
      <div className="flex items-center gap-3">
        <IconChip icon={icon} tone={tone} />
        <span className="text-muted-foreground text-sm font-medium">{label}</span>
        <span className="font-heading ml-auto text-3xl font-semibold tabular-nums">
          {value.toLocaleString("en-US")}
        </span>
      </div>
      {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
    </Card>
  );
}

/** Zero tiles are left out; a profile with nothing to count shows no strip at all. */
export function UserProfileStats({ stats }: { stats: PublicUserProfileStats }) {
  const entries: StatEntry[] = [];
  if (stats.collection !== null && stats.collection.copies > 0) {
    entries.push({
      key: "collection",
      icon: LayersIcon,
      tone: "info",
      label: m.user_profile_stat_collection(),
      value: stats.collection.copies,
      hint: m.user_profile_unique_cards({ count: stats.collection.uniqueCards }),
    });
  }
  if (stats.contributions.total > 0) {
    entries.push({
      key: "contributions",
      icon: PenLineIcon,
      tone: "success",
      label: m.user_profile_stat_contributions(),
      value: stats.contributions.total,
      hint: contributionsHint(stats.contributions),
    });
  }
  if (stats.tournaments.played > 0) {
    entries.push({
      key: "tournaments",
      icon: TrophyIcon,
      tone: "gold",
      label: m.user_profile_stat_tournaments(),
      value: stats.tournaments.played,
      hint: bestFinishHint(stats.tournaments.bestFinish),
    });
  }
  if (stats.decks.total > 0) {
    entries.push({
      key: "decks",
      icon: FolderIcon,
      tone: "violet",
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {entries.map(({ key, ...entry }) => (
        <ProfileStat key={key} {...entry} />
      ))}
    </div>
  );
}
