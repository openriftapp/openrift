import type { CutSize } from "@openrift/shared/pairing/group-cut-types";
import type {
  FinalStandingRow,
  PodRoundResponse,
  PodStandingRow,
} from "@openrift/shared/types/api/pod-tournament";

import { Badge } from "@/components/ui/badge";
import { Podium } from "@/components/ui/podium";
import { RowList, RowListItem } from "@/components/ui/row-list";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MetaRunStrip } from "@/features/meta/components/meta-run-strip";
import { exitLabel, finalStandingsSeats } from "@/features/tournaments/components/podium-seats";
import { StandingsRankCell } from "@/features/tournaments/components/standings-rank-cell";
import { SeedBadge, StandingsIdentity } from "@/features/tournaments/components/standings-table";
import { participantName } from "@/features/tournaments/lib/participant-name";
import type { PlayerLegend } from "@/features/tournaments/lib/player-run";
import { playerRunRounds } from "@/features/tournaments/lib/player-run";
import { standingsRowClass } from "@/features/tournaments/lib/standings-display";
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
  standings,
}: {
  rows: FinalStandingRow[];
  cutSize: CutSize;
  rounds: PodRoundResponse[];
  legendByPlayer: ReadonlyMap<string, PlayerLegend>;
  standings: readonly PodStandingRow[];
}) {
  const showLegend = rows.some((row) => {
    const legend = legendByPlayer.get(row.playerId);
    return legend !== undefined && (legend.legendCardId !== null || legend.legendName !== null);
  });
  const standingByPlayer = new Map(standings.map((row) => [row.playerId, row]));
  const dropped = (playerId: string) => standingByPlayer.get(playerId)?.status === "dropped";
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <SectionHeading>{m.tournaments_final_standings_heading()}</SectionHeading>
        <p className="text-muted-foreground text-sm">
          {m.tournaments_final_standings_description({ size: cutSize })}
        </p>
      </div>
      <RowList variant="divided" className="sm:hidden">
        {rows.map((row) => (
          <RowListItem
            key={row.playerId}
            className={standingsRowClass({
              dropped: dropped(row.playerId),
              leader: row.place === 1,
            })}
          >
            <StandingsRankCell rank={row.place} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <StandingsIdentity
                name={participantName(row.displayName)}
                avatar={standingByPlayer.get(row.playerId)}
                dropped={dropped(row.playerId)}
              />
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-sm">
                <span>{exitLabel(row, cutSize)}</span>
                <SeedBadge seed={row.seed} />
                <Badge variant="neutral">{row.groupLabel}</Badge>
              </div>
            </div>
          </RowListItem>
        ))}
      </RowList>
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
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
              <TableRow
                key={row.playerId}
                className={standingsRowClass({
                  dropped: dropped(row.playerId),
                  leader: row.place === 1,
                })}
              >
                <TableCell>
                  <StandingsRankCell rank={row.place} />
                </TableCell>
                <TableCell>
                  <StandingsIdentity
                    name={participantName(row.displayName)}
                    avatar={standingByPlayer.get(row.playerId)}
                    dropped={dropped(row.playerId)}
                  />
                </TableCell>
                {showLegend ? (
                  <TableCell>
                    <TournamentLegend
                      legendCardId={legendByPlayer.get(row.playerId)?.legendCardId ?? null}
                      fallback={legendByPlayer.get(row.playerId)}
                      className="text-sm"
                    />
                  </TableCell>
                ) : null}
                <TableCell>
                  <MetaRunStrip rounds={playerRunRounds(rounds, row.playerId, true)} />
                </TableCell>
                <TableCell className="text-muted-foreground">{exitLabel(row, cutSize)}</TableCell>
                <TableCell className="text-right">
                  <SeedBadge seed={row.seed} />
                </TableCell>
                <TableCell>
                  <Badge variant="neutral">{row.groupLabel}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.groupPlace}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
