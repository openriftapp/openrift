import { enumLabel } from "@openrift/shared/enum-label";
import { formatDayTimeLocal } from "@openrift/shared/format-date";
import type { TournamentSummaryResponse } from "@openrift/shared/types/api/tournament";
import { CalendarIcon, LayersIcon, UsersIcon } from "lucide-react";

import { MetaItem } from "@/components/ui/meta-item";
import { useDeckFormatList } from "@/hooks/use-enums";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function TournamentMetaLine({
  tournament,
  className,
}: {
  tournament: TournamentSummaryResponse;
  className?: string;
}) {
  const { labels: formatLabels } = useDeckFormatList();
  return (
    <div
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-0.5",
        className,
      )}
    >
      <MetaItem icon={CalendarIcon}>{formatDayTimeLocal(tournament.startsAt)}</MetaItem>
      {tournament.deckFormat ? (
        <MetaItem icon={LayersIcon}>{enumLabel(formatLabels, tournament.deckFormat)}</MetaItem>
      ) : null}
      <MetaItem icon={UsersIcon}>
        {m.tournaments_card_participants({ count: tournament.participantCount })}
      </MetaItem>
    </div>
  );
}
