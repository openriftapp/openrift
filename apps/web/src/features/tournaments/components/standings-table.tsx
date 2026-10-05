import type { PodRoundResponse, PodStandingRow } from "@openrift/shared/types/api/pod-tournament";
import type { TournamentPlayMode } from "@openrift/shared/types/api/tournament";

import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { RowList, RowListItem } from "@/components/ui/row-list";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MetaRunStrip } from "@/features/meta/components/meta-run-strip";
import { PlayerChip } from "@/features/tournaments/components/player-chip";
import { StandingsRankCell } from "@/features/tournaments/components/standings-rank-cell";
import { TournamentLegend } from "@/features/tournaments/components/tournament-legend";
import { playerRunRounds } from "@/features/tournaments/lib/player-run";
import {
  formatMatchRecord,
  formatPlayerRecord,
  formatScore,
  podWinsHint,
  rankedStandings,
} from "@/features/tournaments/lib/standings-display";
import { collapseTeamStandings } from "@/features/tournaments/lib/team-display";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

function PlayerIdentity({ row, regionsEnabled }: { row: PodStandingRow; regionsEnabled: boolean }) {
  return (
    <PlayerChip
      name={row.displayName}
      image={row.image}
      gravatarHash={row.gravatarHash}
      region={regionsEnabled ? row.region : null}
      dropped={row.status === "dropped"}
    />
  );
}

export function StandingsTable({
  standings: standingsInput,
  variant = "pod",
  playMode = "1v1",
  regionsEnabled = false,
  rounds,
  legendByPlayer,
}: {
  standings: PodStandingRow[];
  /** Adds a round-by-round strip per player. */
  rounds?: PodRoundResponse[];
  /** Player id -> Legend card id; adds a Legend column when any player has one. */
  legendByPlayer?: ReadonlyMap<string, string | null>;
  /** Column set: FFA pods (score/wins/pod tallies) or Swiss (points/W-L-D). */
  variant?: "pod" | "swiss";
  /** 2v2 collapses teammate rows into one row per team. */
  playMode?: TournamentPlayMode;
  /** Shows each player's region alongside their name. */
  regionsEnabled?: boolean;
}) {
  const teamMode = playMode === "2v2";
  const standings = teamMode ? collapseTeamStandings(standingsInput) : standingsInput;
  if (standings.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyDescription>{m.tournaments_standings_empty()}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  const swiss = variant === "swiss";
  const ranked = rankedStandings(standings);
  const showLegend =
    !teamMode &&
    legendByPlayer !== undefined &&
    standings.some((row) => (legendByPlayer.get(row.playerId) ?? null) !== null);
  const showRun = rounds !== undefined && rounds.length > 0;
  return (
    <>
      <RowList variant="divided" className="sm:hidden">
        {ranked.map(({ row, rank }) => (
          <RowListItem
            key={row.playerId}
            className={cn(
              row.status === "dropped" && "opacity-50",
              rank === 1 && "bg-border-accent/5",
            )}
          >
            <StandingsRankCell rank={rank} />
            <div className="min-w-0 flex-1">
              <PlayerIdentity row={row} regionsEnabled={regionsEnabled} />
              <div className="text-muted-foreground flex gap-x-3 text-sm">
                <span
                  className={swiss ? "tabular-nums" : undefined}
                  title={swiss ? undefined : podWinsHint()}
                >
                  {formatPlayerRecord(row, swiss)}
                </span>
                <span title={m.tournaments_standings_opp_title()}>
                  {m.tournaments_standings_tiebreak_opp({
                    value: formatScore(row.avgOpponentScore),
                  })}
                </span>
                <span title={m.tournaments_standings_game_title()}>
                  {m.tournaments_standings_tiebreak_game_points({ value: row.gamePoints })}
                </span>
              </div>
            </div>
            <span className="shrink-0 font-semibold tabular-nums">{formatScore(row.score)}</span>
          </RowListItem>
        ))}
      </RowList>

      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">#</TableHead>
              <TableHead>
                {teamMode
                  ? m.tournaments_standings_col_team()
                  : m.tournaments_standings_col_player()}
              </TableHead>
              {showLegend ? <TableHead>{m.tournaments_standings_col_legend()}</TableHead> : null}
              {showRun ? <TableHead>{m.tournaments_standings_col_run()}</TableHead> : null}
              <TableHead className="text-right">
                {swiss ? m.tournaments_standings_col_points() : m.tournaments_standings_col_score()}
              </TableHead>
              {swiss ? (
                <TableHead className="text-right">{m.tournaments_standings_col_record()}</TableHead>
              ) : (
                <TableHead className="text-right" title={podWinsHint()}>
                  {m.tournaments_standings_col_pod_wins()}
                </TableHead>
              )}
              <TableHead className="text-right" title={m.tournaments_standings_opp_title()}>
                {m.tournaments_standings_col_opp()}
              </TableHead>
              <TableHead className="text-right" title={m.tournaments_standings_game_title()}>
                {m.tournaments_standings_col_game()}
              </TableHead>
              <TableHead className="text-right">{m.tournaments_standings_col_rounds()}</TableHead>
              {swiss ? null : (
                <>
                  <TableHead className="text-right">
                    {m.tournaments_standings_col_pods3()}
                  </TableHead>
                  <TableHead className="text-right">
                    {m.tournaments_standings_col_pods4()}
                  </TableHead>
                </>
              )}
              <TableHead className="text-right">{m.tournaments_standings_col_byes()}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranked.map(({ row, rank }) => (
              <TableRow
                key={row.playerId}
                className={cn(
                  row.status === "dropped" && "opacity-50",
                  rank === 1 && "bg-border-accent/5",
                )}
              >
                <TableCell>
                  <StandingsRankCell rank={rank} />
                </TableCell>
                <TableCell>
                  <PlayerIdentity row={row} regionsEnabled={regionsEnabled} />
                </TableCell>
                {showLegend ? (
                  <TableCell>
                    <TournamentLegend
                      legendCardId={legendByPlayer.get(row.playerId) ?? null}
                      className="text-sm"
                    />
                  </TableCell>
                ) : null}
                {showRun ? (
                  <TableCell>
                    <MetaRunStrip rounds={playerRunRounds(rounds, row.playerId, false)} />
                  </TableCell>
                ) : null}
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatScore(row.score)}
                </TableCell>
                {swiss ? (
                  <TableCell className="text-right tabular-nums">
                    {formatMatchRecord(row)}
                  </TableCell>
                ) : (
                  <TableCell className="text-right tabular-nums">{row.podWins}</TableCell>
                )}
                <TableCell className="text-right tabular-nums">
                  {formatScore(row.avgOpponentScore)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.gamePoints}</TableCell>
                <TableCell className="text-right tabular-nums">{row.roundsPlayed}</TableCell>
                {swiss ? null : (
                  <>
                    <TableCell className="text-right tabular-nums">{row.pods3Count}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.pods4Count}</TableCell>
                  </>
                )}
                <TableCell className="text-right tabular-nums">{row.byeCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
