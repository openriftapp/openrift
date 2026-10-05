import type { CutSize } from "@openrift/shared/pairing/group-cut-types";
import type {
  GroupStageView,
  PodMemberResponse,
  PodResponse,
  PodRoundResponse,
} from "@openrift/shared/types/api/pod-tournament";

import {
  BracketColumn,
  BracketColumns,
  BracketEmptySeat,
  BracketMatchCard,
  BracketRankMark,
  BracketSeatRow,
  BracketSeedMark,
} from "@/components/bracket/bracket";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatRank } from "@/features/meta/lib/meta-format";
import type { BracketMatch } from "@/features/tournaments/lib/cut-bracket-display";
import { buildBracketColumns, isHigherSeed } from "@/features/tournaments/lib/cut-bracket-display";
import { cutMatchShortLabel } from "@/features/tournaments/lib/group-cut-display";
import { groupLabelByPlayer, isWalkoverPod } from "@/features/tournaments/lib/group-cut-units";
import type { PlayerLegend } from "@/features/tournaments/lib/player-run";
import { legendsByPlayer } from "@/features/tournaments/lib/player-run";
import { pairingLabel } from "@/features/tournaments/lib/tournament-display";
import { m } from "@/paraglide/messages.js";

import { TournamentLegend } from "./tournament-legend";

interface SeatContext {
  cutSize: CutSize;
  seedByPlayer: Map<string, number>;
  legendByPlayer: Map<string, PlayerLegend>;
  groupByPlayer: Map<string, string>;
  placeByPlayer: Map<string, number>;
}

function seatScore(pod: PodResponse, member: PodMemberResponse, winner: boolean) {
  if (isWalkoverPod(pod)) {
    return winner ? m.tournaments_cut_walkover_win() : "–";
  }
  return member.gamePoints ?? "–";
}

function Seat({
  member,
  pod,
  context,
}: {
  member: PodMemberResponse;
  pod: PodResponse;
  context: SeatContext;
}) {
  const winner = member.placement === 1;
  const place = context.placeByPlayer.get(member.playerId);
  const seed = context.seedByPlayer.get(member.playerId);
  const legend = context.legendByPlayer.get(member.playerId);
  const group = context.groupByPlayer.get(member.playerId);
  const open = pod.resultStatus !== "reported";
  const chooser = open && isHigherSeed(pod, member.playerId, context.seedByPlayer);
  return (
    <BracketSeatRow
      winner={winner}
      mark={
        place === undefined ? (
          <BracketSeedMark>
            <Badge variant="outline" className="w-8 justify-center tabular-nums">
              {seed === undefined ? "–" : `#${seed}`}
            </Badge>
          </BracketSeedMark>
        ) : (
          <BracketRankMark rank={place} text={formatRank(place, false)} />
        )
      }
      name={member.displayName}
      score={seatScore(pod, member, winner)}
    >
      {group ? (
        <Badge variant="neutral" className="shrink-0">
          {group}
        </Badge>
      ) : null}
      {chooser ? (
        <span className="text-muted-foreground shrink-0 text-xs">
          {m.tournaments_cut_chooses_starter()}
        </span>
      ) : null}
      {legend ? (
        <TournamentLegend
          legendCardId={legend.legendCardId}
          fallback={legend}
          championOnly
          className="text-muted-foreground hidden shrink-0 text-xs sm:flex"
        />
      ) : null}
    </BracketSeatRow>
  );
}

function Match({
  match,
  roundNumber,
  context,
  isFinal,
}: {
  match: BracketMatch;
  roundNumber: number;
  context: SeatContext;
  isFinal: boolean;
}) {
  const pod = match.pod;
  return (
    <BracketMatchCard
      isFinal={isFinal}
      label={cutMatchShortLabel(context.cutSize, roundNumber, match.podNumber)}
      aside={pairingLabel(match.podNumber)}
    >
      {pod === null
        ? (
            match.feeders ?? [m.tournaments_cut_not_drawn_yet(), m.tournaments_cut_not_drawn_yet()]
          ).map((feeder, index) => (
            <BracketEmptySeat key={`${match.key}:${index}`}>
              {match.feeders ? m.tournaments_cut_winner_of({ match: feeder }) : feeder}
            </BracketEmptySeat>
          ))
        : pod.members.map((member) => (
            <Seat key={member.playerId} member={member} pod={pod} context={context} />
          ))}
    </BracketMatchCard>
  );
}

export function CutBracketCompact({
  rounds,
  cutSize,
  groupStage,
}: {
  rounds: PodRoundResponse[];
  cutSize: CutSize;
  groupStage: GroupStageView;
}) {
  const columns = buildBracketColumns(rounds, cutSize);
  if (!groupStage.cutGenerated) {
    return null;
  }
  const context: SeatContext = {
    cutSize,
    groupByPlayer: groupLabelByPlayer(groupStage.groups),
    seedByPlayer: new Map(
      groupStage.ranking.flatMap((row) => (row.seed === null ? [] : [[row.playerId, row.seed]])),
    ),
    legendByPlayer: legendsByPlayer(groupStage),
    placeByPlayer: new Map(
      (groupStage.finalStandings ?? []).map((row) => [row.playerId, row.place] as const),
    ),
  };

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading>{m.tournaments_cut_top_heading({ size: cutSize })}</SectionHeading>
      <BracketColumns columnCount={columns.length}>
        {columns.map((column, index) => (
          <BracketColumn key={column.roundNumber} label={column.label}>
            {column.matches.map((match) => (
              <Match
                key={match.key}
                match={match}
                roundNumber={column.roundNumber}
                context={context}
                isFinal={index === columns.length - 1}
              />
            ))}
          </BracketColumn>
        ))}
      </BracketColumns>
    </section>
  );
}
