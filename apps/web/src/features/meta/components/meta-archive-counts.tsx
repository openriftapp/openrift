import { m } from "@/paraglide/messages.js";
// Pinned to `en-US` grouping (not the runtime's locale): the page is server-rendered,
// and a server on a different locale would otherwise mismatch what the browser renders.
function grouped(value: number): string {
  return value.toLocaleString("en-US");
}

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
      <CountItem value={eventCount} label={m.meta_counts_archived_events()} />
      <CountItem value={playerResultCount} label={m.meta_counts_player_results()} />
      <CountItem value={deckCount} label={m.meta_counts_decklists()} />
    </div>
  );
}

function CountItem({ value, label }: { value: number; label: string }) {
  return (
    <p className="flex flex-col gap-0.5">
      <span className="font-heading text-2xl leading-none font-bold tabular-nums">
        {grouped(value)}
      </span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </p>
  );
}
