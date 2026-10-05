import { StatFigure } from "@/components/ui/stat-figure";
import { formatCount } from "@/lib/format";
import { m } from "@/paraglide/messages.js";

export function MetaArchiveCounts({
  eventCount,
  playerResultCount,
  deckCount,
}: {
  eventCount: number;
  playerResultCount: number;
  deckCount: number;
}) {
  return (
    <div className="flex flex-wrap gap-x-10 gap-y-4 sm:gap-x-12">
      <StatFigure value={formatCount(eventCount)} label={m.meta_counts_archived_events()} />
      <StatFigure value={formatCount(playerResultCount)} label={m.meta_counts_player_results()} />
      <StatFigure value={formatCount(deckCount)} label={m.meta_counts_decklists()} />
    </div>
  );
}
