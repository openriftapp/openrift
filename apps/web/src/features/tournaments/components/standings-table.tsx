import type { PodRoundResponse, PodStandingRow } from "@openrift/shared/types/api/pod-tournament";
import type { TournamentPlayMode } from "@openrift/shared/types/api/tournament";

import { Badge } from "@/components/ui/badge";
import { Medal } from "@/components/ui/podium";
import { RowList, RowListItem } from "@/components/ui/row-list";
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
import { TournamentLegend } from "@/features/tournaments/components/tournament-legend";
import { playerRunRounds } from "@/features/tournaments/lib/player-run";
import { collapseTeamStandings } from "@/features/tournaments/lib/team-display";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { formatPlayerRecord, formatScore, podWinsHint, rankedStandings } from "./standings-display";

// Named module-level default: an inline arrow default is not reorderable and
// makes the React Compiler bail out.
const rawRegionSlug = (slug: string): string => slug;

function RankMark({ rank }: { rank: number }) {
  if (rank <= 3) {
    return <Medal rank={rank} />;
  }
  return <span className="text-muted-foreground tabular-nums">{rank}</span>;
}

function PlayerIdentity({
  row,
  regionsEnabled,
  regionLabel,
}: {
  row: PodStandingRow;
  regionsEnabled: boolean;
  regionLabel: (slug: string) => string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <UserAvatar name={row.displayName} size="sm" className="shrink-0" />
      <span className="truncate font-medium">{row.displayName}</span>
      {regionsEnabled && row.region ? (
        <Badge variant="outline" className="shrink-0">
          {regionLabel(row.region)}
        </Badge>
      ) : null}
      {row.status === "dropped" ? (
        <span className="text-muted-foreground shrink-0 text-sm">
          {m.tournaments_standings_dropped()}
        </span>
      ) : null}
    </div>
  );
}

export function StandingsTable({
  standings: standingsInput,
  variant = "pod",
  playMode = "1v1",
  regionsEnabled = false,
  regionLabel = rawRegionSlug,
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
  /** Region slug -> display label; defaults to the raw slug. */
  regionLabel?: (slug: string) => string;
}) {
  const teamMode = playMode === "2v2";
  const standings = teamMode ? collapseTeamStandings(standingsInput) : standingsInput;
  if (standings.length === 0) {
    return <p className="text-muted-foreground">{m.tournaments_standings_empty()}</p>;
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
            <div className="flex w-6 shrink-0 justify-end">
              <RankMark rank={rank} />
            </div>
            <div className="min-w-0 flex-1">
              <PlayerIdentity row={row} regionsEnabled={regionsEnabled} regionLabel={regionLabel} />
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
              <TableHead className="w-10">#</TableHead>
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
                  <RankMark rank={rank} />
                </TableCell>
                <TableCell>
                  <PlayerIdentity
                    row={row}
                    regionsEnabled={regionsEnabled}
                    regionLabel={regionLabel}
                  />
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
                    {row.wins}-{row.losses}-{row.draws}
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
