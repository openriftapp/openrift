import type { MetaStandingsRow } from "@openrift/shared/types/api/meta";
import type { ComponentType } from "react";

import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RowProps } from "@/features/meta/components/meta-event-standings-rows";
import { DesktopRow, PhoneRow } from "@/features/meta/components/meta-event-standings-rows";
import type { RowWindow } from "@/features/meta/hooks/use-standings-row-window";
import { useRowWindow } from "@/features/meta/hooks/use-standings-row-window";
import type { MetaBanGroup } from "@/features/meta/lib/meta-deck-bans";
import type { MetaDeckCost } from "@/features/meta/lib/meta-deck-collection";
import type { StandingsColumns } from "@/features/meta/lib/meta-event-standings";
import type { MetaPendingRowMark } from "@/features/meta/lib/meta-pending-submissions";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export interface StandingsBodyProps {
  players: readonly MetaStandingsRow[];
  slug: string;
  canSubmit: boolean;
  columns: StandingsColumns;
  costs: ReadonlyMap<string, MetaDeckCost> | undefined;
  bans: ReadonlyMap<string, MetaBanGroup[]> | undefined;
  /** UTC date. */
  eventDate: string;
  pending: ReadonlyMap<string, MetaPendingRowMark>;
  cutSize: number | null;
  expandedId: string | null;
  onToggle: (id: string) => void;
}

export function DesktopStandingsHeader({
  columns,
  className,
}: {
  columns: StandingsColumns;
  className?: string;
}) {
  return (
    <TableHeader className={cn("block", className)}>
      <TableRow className="flex w-full">
        <TableHead className="flex w-24 shrink-0 items-center justify-center">
          {m.meta_standings_col_rank()}
        </TableHead>
        {columns.legend && (
          <TableHead className="flex w-64 shrink-0 items-center">
            {m.meta_standings_col_legend()}
          </TableHead>
        )}
        <TableHead className="flex min-w-0 flex-1 items-center">
          {m.meta_standings_col_player()}
        </TableHead>
        {(columns.run || columns.record) && (
          <TableHead className="flex w-52 shrink-0 items-center">
            {columns.run ? m.meta_standings_col_run() : m.meta_finishes_col_record()}
          </TableHead>
        )}
        {columns.value && (
          <TableHead className="flex w-28 shrink-0 items-center justify-end">
            {m.meta_standings_col_value()}
          </TableHead>
        )}
        {columns.deck && (
          <TableHead className="flex w-36 shrink-0 items-center justify-end">
            {m.meta_standings_decklist()}
          </TableHead>
        )}
      </TableRow>
    </TableHeader>
  );
}

function StandingsRows({
  Row,
  rows,
  slug,
  canSubmit,
  columns,
  costs,
  bans,
  eventDate,
  pending,
  cutSize,
  expandedId,
  onToggle,
}: Omit<StandingsBodyProps, "players"> & {
  Row: ComponentType<RowProps>;
  rows: RowWindow["rows"];
}) {
  return rows.map(({ player, slot }) => (
    <Row
      key={player.id}
      {...slot}
      player={player}
      slug={slug}
      canSubmit={canSubmit}
      columns={columns}
      costs={costs}
      banGroups={player.deckId === null ? undefined : bans?.get(player.deckId)}
      eventDate={eventDate}
      pending={pending.get(player.id)}
      cutSize={cutSize}
      expanded={expandedId === player.id}
      onToggle={() => onToggle(player.id)}
    />
  ));
}

export function DesktopStandings({
  players,
  header = "visible",
  ...body
}: StandingsBodyProps & { header?: "visible" | "screen-reader" }) {
  const { containerRef, height, rows } = useRowWindow(players);

  return (
    <div className="hidden md:block">
      <Table variant="divided" className="block">
        <DesktopStandingsHeader
          columns={body.columns}
          className={header === "screen-reader" ? "sr-only" : undefined}
        />
        <TableBody ref={containerRef} className="relative block" style={{ height }}>
          <StandingsRows Row={DesktopRow} rows={rows} {...body} />
        </TableBody>
      </Table>
    </div>
  );
}

export function PhoneStandings({ players, ...body }: StandingsBodyProps) {
  const { containerRef, height, rows } = useRowWindow(players);

  return (
    <ul
      ref={containerRef}
      className="relative block md:hidden [&>li+li]:border-t"
      style={{ height }}
    >
      <StandingsRows Row={PhoneRow} rows={rows} {...body} />
    </ul>
  );
}
