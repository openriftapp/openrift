import type { MetaStandingsRow } from "@openrift/shared/types/api/meta";

import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DesktopRow, PhoneRow } from "@/features/meta/components/meta-event-standings-rows";
import { useRowWindow } from "@/features/meta/hooks/use-standings-row-window";
import type { MetaDeckCost } from "@/features/meta/lib/meta-deck-collection";
import type { StandingsColumns } from "@/features/meta/lib/meta-event-standings";
import type { MetaPendingRowMark } from "@/features/meta/lib/meta-pending-submissions";
import { m } from "@/paraglide/messages.js";

export interface StandingsBodyProps {
  players: readonly MetaStandingsRow[];
  slug: string;
  canSubmit: boolean;
  columns: StandingsColumns;
  costs: ReadonlyMap<string, MetaDeckCost> | undefined;
  pending: ReadonlyMap<string, MetaPendingRowMark>;
  cutSize: number | null;
  expandedId: string | null;
  onToggle: (id: string) => void;
}

export function DesktopStandings({
  players,
  slug,
  canSubmit,
  columns,
  costs,
  pending,
  cutSize,
  expandedId,
  onToggle,
}: StandingsBodyProps) {
  const { containerRef, height, rows } = useRowWindow(players);

  return (
    <div className="hidden md:block">
      <Table variant="divided" className="block">
        <TableHeader className="block">
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
        <TableBody ref={containerRef} className="relative block" style={{ height }}>
          {rows.map(({ player, slot }) => (
            <DesktopRow
              key={player.id}
              {...slot}
              player={player}
              slug={slug}
              canSubmit={canSubmit}
              columns={columns}
              costs={costs}
              pending={pending.get(player.id)}
              cutSize={cutSize}
              expanded={expandedId === player.id}
              onToggle={() => onToggle(player.id)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function PhoneStandings({
  players,
  slug,
  canSubmit,
  columns,
  costs,
  pending,
  cutSize,
  expandedId,
  onToggle,
}: StandingsBodyProps) {
  const { containerRef, height, rows } = useRowWindow(players);

  return (
    <ul
      ref={containerRef}
      className="relative -mx-3 block md:hidden [&>li+li]:border-t"
      style={{ height }}
    >
      {rows.map(({ player, slot }) => (
        <PhoneRow
          key={player.id}
          {...slot}
          player={player}
          slug={slug}
          canSubmit={canSubmit}
          columns={columns}
          costs={costs}
          pending={pending.get(player.id)}
          cutSize={cutSize}
          expanded={expandedId === player.id}
          onToggle={() => onToggle(player.id)}
        />
      ))}
    </ul>
  );
}
