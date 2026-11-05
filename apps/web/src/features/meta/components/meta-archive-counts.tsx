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
  const tiles = [
    { count: eventCount, label: m.meta_counts_archived_events() },
    { count: playerResultCount, label: m.meta_counts_player_results() },
    { count: deckCount, label: m.meta_counts_decklists() },
  ].filter((tile) => tile.count > 0);
  if (tiles.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-x-10 gap-y-4 sm:gap-x-12">
      {tiles.map((tile) => (
        <StatFigure key={tile.label} value={formatCount(tile.count)} label={tile.label} />
      ))}
    </div>
  );
}
