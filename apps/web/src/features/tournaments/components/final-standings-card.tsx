import type { CutSize } from "@openrift/shared/pairing/group-cut-types";
import type {
  FinalStandingRow,
  PodRoundResponse,
  PodStandingRow,
} from "@openrift/shared/types/api/pod-tournament";

import { Badge } from "@/components/ui/badge";
import { Medal, Podium } from "@/components/ui/podium";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserAvatar } from "@/components/user-avatar";
import { MetaRunStrip } from "@/features/meta/components/meta-run-strip";
import {
  exitLabel,
  finalStandingsSeats,
} from "@/features/tournaments/components/final-standings-display";
import type { PlayerLegend } from "@/features/tournaments/lib/player-run";
import { playerRunRounds } from "@/features/tournaments/lib/player-run";
import { m } from "@/paraglide/messages.js";

import { TournamentLegend } from "./tournament-legend";

export function FinalStandingsPodium({
  rows,
  standings,
  cutSize,
}: {
  rows: FinalStandingRow[];
  standings: PodStandingRow[];
  cutSize: CutSize;
}) {
  return <Podium seats={finalStandingsSeats(rows, standings, cutSize)} />;
}

export function FinalStandingsCard({
  rows,
  cutSize,
  rounds,
  legendByPlayer,
}: {
  rows: FinalStandingRow[];
  cutSize: CutSize;
  rounds: PodRoundResponse[];
  legendByPlayer: ReadonlyMap<string, PlayerLegend>;
}) {
  const showLegend = rows.some((row) => legendByPlayer.get(row.playerId)?.legendName);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <SectionHeading>{m.tournaments_final_standings_heading()}</SectionHeading>
        <p className="text-muted-foreground text-sm">
          {m.tournaments_final_standings_description({ size: cutSize })}
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>{m.tournaments_standings_col_player()}</TableHead>
            {showLegend ? <TableHead>{m.tournaments_standings_col_legend()}</TableHead> : null}
            <TableHead>{m.tournaments_standings_col_run()}</TableHead>
            <TableHead>{m.tournaments_final_standings_col_result()}</TableHead>
            <TableHead className="text-right">{m.tournaments_group_col_seed()}</TableHead>
            <TableHead>{m.tournaments_group_col_group()}</TableHead>
            <TableHead className="text-right">
              {m.tournaments_final_standings_col_group_place()}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.playerId}>
              <TableCell>
                {row.place <= 3 ? (
                  <Medal rank={row.place} />
                ) : (
                  <span className="text-muted-foreground tabular-nums">{row.place}</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex min-w-0 items-center gap-2">
                  <UserAvatar name={row.displayName} size="sm" className="shrink-0" />
                  <span className="truncate font-medium">{row.displayName}</span>
                </div>
              </TableCell>
              {showLegend ? (
                <TableCell>
                  <TournamentLegend
                    legendCardId={legendByPlayer.get(row.playerId)?.legendCardId ?? null}
                    legendName={legendByPlayer.get(row.playerId)?.legendName}
                    className="text-sm"
                  />
                </TableCell>
              ) : null}
              <TableCell>
                <MetaRunStrip rounds={playerRunRounds(rounds, row.playerId, true)} />
              </TableCell>
              <TableCell className="text-muted-foreground">{exitLabel(row, cutSize)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {row.seed === null ? "" : `#${row.seed}`}
              </TableCell>
              <TableCell>
                <Badge variant="muted">{row.groupLabel}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.groupPlace}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
