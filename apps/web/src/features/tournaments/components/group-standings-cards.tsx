import type {
  GroupCutTierView,
  GroupStageGroupView,
  GroupStageView,
  GroupStandingRowView,
} from "@openrift/shared/types/api/pod-tournament";
import { TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Medal } from "@/components/ui/podium";
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
import { TournamentLegend } from "@/features/tournaments/components/tournament-legend";
import { formatWinRate, groupCutTierLabels } from "@/features/tournaments/lib/group-cut-display";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

function DecidedByBadge({ tier }: { tier: GroupCutTierView | null }) {
  if (tier === null) {
    return null;
  }
  return (
    <Badge variant={tier === "meta_pending" ? "warning" : "muted"}>
      {groupCutTierLabels()[tier]}
    </Badge>
  );
}

function RankMark({ place }: { place: number }) {
  if (place <= 3) {
    return <Medal rank={place} />;
  }
  return <span className="text-muted-foreground tabular-nums">{place}</span>;
}

function PlayerCell({ row }: { row: Pick<GroupStandingRowView, "displayName" | "status"> }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <UserAvatar name={row.displayName} size="sm" className="shrink-0" />
      <span className="truncate font-medium">{row.displayName}</span>
      {row.status === "dropped" ? (
        <span className="text-muted-foreground shrink-0 text-sm">
          {m.tournaments_group_dropped_marker()}
        </span>
      ) : null}
    </div>
  );
}

function groupDescription(group: GroupStageGroupView): string {
  const count = group.playerIds.length;
  const players =
    count === 1
      ? m.tournaments_group_players_count_one({ count })
      : m.tournaments_group_players_count_other({ count });
  return group.pairedGroupLabel === null
    ? players
    : m.tournaments_group_cross_group_suffix({ players });
}

export function GroupStandingsCard({ group }: { group: GroupStageGroupView }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <SectionHeading>{m.tournaments_group_heading({ label: group.label })}</SectionHeading>
          {group.pairedGroupLabel === null ? null : (
            <Badge variant="info">
              {m.tournaments_group_paired_with({ label: group.pairedGroupLabel })}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">{groupDescription(group)}</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>{m.tournaments_group_col_player()}</TableHead>
            <TableHead>{m.tournaments_group_col_legend()}</TableHead>
            <TableHead className="text-right">{m.tournaments_group_col_points()}</TableHead>
            <TableHead className="text-right">{m.tournaments_standings_col_record()}</TableHead>
            <TableHead className="text-right">{m.tournaments_group_col_gw()}</TableHead>
            <TableHead>{m.tournaments_group_decided_by_head()}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {group.standings.map((row) => (
            <TableRow key={row.playerId} className={cn(row.status === "dropped" && "opacity-50")}>
              <TableCell>
                <RankMark place={row.place} />
              </TableCell>
              <TableCell>
                <PlayerCell row={row} />
              </TableCell>
              <TableCell>
                <TournamentLegend
                  legendCardId={row.legendCardId}
                  legendName={row.legendName}
                  className="text-sm"
                />
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{row.points}</TableCell>
              <TableCell className="text-right tabular-nums">
                {row.wins}-{row.losses}-{row.draws}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatWinRate(row.gameWinRate)}
              </TableCell>
              <TableCell>
                <DecidedByBadge tier={row.decidedBy} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

export function CutSeedsCard({
  groupStage,
  cutSize,
}: {
  groupStage: GroupStageView;
  cutSize: number;
}) {
  const qualified = groupStage.ranking.filter((row) => row.qualified);
  const missedOut = groupStage.ranking.filter((row) => !row.qualified).slice(0, 3);
  if (qualified.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <SectionHeading>
            {m.tournaments_group_top_seeds_heading({ size: cutSize })}
          </SectionHeading>
          {groupStage.cutGenerated ? (
            <Badge variant="secondary">{m.tournaments_group_seeds_locked()}</Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm">{m.tournaments_group_seeds_description()}</p>
      </div>
      {groupStage.seedsDiverged ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertDescription>{m.tournaments_group_seeds_diverged()}</AlertDescription>
        </Alert>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">{m.tournaments_group_col_seed()}</TableHead>
            <TableHead>{m.tournaments_group_col_player()}</TableHead>
            <TableHead>{m.tournaments_group_col_group()}</TableHead>
            <TableHead className="text-right">{m.tournaments_group_col_place()}</TableHead>
            <TableHead className="text-right">{m.tournaments_group_col_mw()}</TableHead>
            <TableHead className="text-right">{m.tournaments_group_col_gw()}</TableHead>
            <TableHead>{m.tournaments_group_decided_by_head()}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {qualified.map((row) => (
            <TableRow key={row.playerId}>
              <TableCell>
                <Badge variant="outline" className="tabular-nums">
                  #{row.seed ?? "-"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex min-w-0 items-center gap-2">
                  <UserAvatar name={row.displayName} size="sm" className="shrink-0" />
                  <span className="truncate font-medium">{row.displayName}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="muted">{row.groupLabel}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.place}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatWinRate(row.matchWinRate)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatWinRate(row.gameWinRate)}
              </TableCell>
              <TableCell>
                <DecidedByBadge tier={row.decidedBy} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {missedOut.length > 0 ? (
        <p className="text-muted-foreground text-sm">
          {m.tournaments_group_did_not_qualify({
            names: missedOut.map((row) => row.displayName).join(", "),
          })}
        </p>
      ) : null}
    </section>
  );
}

export function GroupTiebreakNote({ legendTiebreak }: { legendTiebreak: boolean }) {
  return (
    <p className="text-muted-foreground text-sm">
      {m.tournaments_group_tiebreak_note({
        legend: legendTiebreak ? m.tournaments_group_tiebreak_note_legend() : "",
      })}
    </p>
  );
}
