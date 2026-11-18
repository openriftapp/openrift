import type { CutSize } from "@openrift/shared/pairing/group-cut-types";
import type {
  GroupStageView,
  PodMemberResponse,
  PodResponse,
  PodRoundResponse,
} from "@openrift/shared/types/api/pod-tournament";
import type { TournamentMatchFormat } from "@openrift/shared/types/api/tournament";

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
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { TouchTooltip } from "@/components/ui/touch-tooltip";
import { formatRank } from "@/features/meta/lib/meta-format";
import { usePodResultEditor } from "@/features/tournaments/hooks/use-pod-result-editor";
import {
  buildBracketColumns,
  collapsedBracketRounds,
  isHigherSeed,
  seedsByPlayer,
} from "@/features/tournaments/lib/cut-bracket-display";
import type { BracketMatch } from "@/features/tournaments/lib/cut-bracket-display";
import { cutMatchShortLabel } from "@/features/tournaments/lib/group-cut-display";
import {
  groupLabelByPlayer,
  isDoubleForfeitPod,
  isWalkoverPod,
  podForDisplay,
} from "@/features/tournaments/lib/group-cut-units";
import { participantName } from "@/features/tournaments/lib/participant-name";
import type { PlayerLegend } from "@/features/tournaments/lib/player-run";
import { legendsByPlayer } from "@/features/tournaments/lib/player-run";
import type { PodResultSubmission } from "@/features/tournaments/lib/swiss-results";
import { pairingLabel } from "@/features/tournaments/lib/tournament-display";
import { m } from "@/paraglide/messages.js";

import { SwissResultForm } from "./swiss-result-form";
import { TournamentLegend } from "./tournament-legend";

/** Result entry for the bracket; without it the bracket is read-only. */
export interface CutBracketEntry {
  matchFormat: TournamentMatchFormat;
  winPoints: number;
  drawPoints: number;
  canEnterResult: (round: PodRoundResponse, pod: PodResponse) => boolean;
  onSubmitResult: (podId: string, submission: PodResultSubmission) => Promise<unknown>;
}

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
  let outcome: "won" | "lost" | undefined;
  if (!open) {
    outcome = winner ? "won" : "lost";
  }
  const chooser = open && isHigherSeed(pod, member.playerId, context.seedByPlayer);
  return (
    <BracketSeatRow
      outcome={outcome}
      mark={
        place === undefined ? (
          <BracketSeedMark>
            {seed === undefined ? (
              <Badge variant="outline" className="w-8 justify-center tabular-nums">
                –
              </Badge>
            ) : (
              <TouchTooltip
                content={
                  chooser
                    ? m.tournaments_cut_seed_chooser_tooltip({ seed })
                    : m.tournaments_cut_seed_tooltip({ seed })
                }
                aria-label={
                  chooser
                    ? m.tournaments_cut_seed_chooser_tooltip({ seed })
                    : m.tournaments_cut_seed_tooltip({ seed })
                }
              >
                <Badge
                  variant={chooser ? "default" : "outline"}
                  className="w-8 justify-center tabular-nums"
                >
                  #{seed}
                </Badge>
              </TouchTooltip>
            )}
          </BracketSeedMark>
        ) : (
          <BracketRankMark rank={place} text={formatRank(place, false)} />
        )
      }
      name={
        legend ? (
          <span className="flex flex-col leading-tight">
            <span className="truncate">{participantName(member.displayName)}</span>
            <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs font-normal">
              <TournamentLegend
                legendCardId={legend.legendCardId}
                fallback={legend}
                championOnly
                className="shrink-0"
              />
            </span>
          </span>
        ) : (
          participantName(member.displayName)
        )
      }
      score={seatScore(pod, member, winner)}
    >
      {group ? (
        <TouchTooltip
          content={m.tournaments_cut_group_tooltip({ group })}
          aria-label={m.tournaments_cut_group_tooltip({ group })}
          className="shrink-0"
        >
          <Badge variant="neutral">{group}</Badge>
        </TouchTooltip>
      ) : null}
    </BracketSeatRow>
  );
}

function Match({
  match,
  round,
  roundNumber,
  context,
  isFinal,
  entry,
}: {
  match: BracketMatch;
  round: PodRoundResponse | undefined;
  roundNumber: number;
  context: SeatContext;
  isFinal: boolean;
  entry: CutBracketEntry | undefined;
}) {
  const pod = match.pod;
  const editor = usePodResultEditor((submission) =>
    pod === null || entry === undefined
      ? Promise.resolve()
      : entry.onSubmitResult(pod.id, submission),
  );
  const canEnter =
    entry !== undefined && pod !== null && round !== undefined && entry.canEnterResult(round, pod);
  const reported = pod?.resultStatus === "reported";

  let seats;
  if (pod === null) {
    seats = (
      match.feeders ?? [m.tournaments_cut_not_drawn_yet(), m.tournaments_cut_not_drawn_yet()]
    ).map((feeder, index) => (
      <BracketEmptySeat key={`${match.key}:${index}`}>
        {match.feeders ? m.tournaments_cut_winner_of({ match: feeder }) : feeder}
      </BracketEmptySeat>
    ));
  } else if (canEnter && editor.editing) {
    seats = (
      <div className="p-3">
        <SwissResultForm
          pod={podForDisplay(pod)}
          matchFormat={entry.matchFormat}
          winPoints={entry.winPoints}
          drawPoints={entry.drawPoints}
          allowDraws={false}
          showPoints={false}
          onSubmit={(submission) => void editor.submit(submission)}
          submitting={editor.saving}
          error={editor.error}
          onCancel={editor.handleCancel}
        />
      </div>
    );
  } else {
    seats = pod.members.map((member) => (
      <Seat key={member.playerId} member={member} pod={pod} context={context} />
    ));
  }

  return (
    <BracketMatchCard
      isFinal={isFinal}
      pending={pod === null}
      label={
        pod !== null && isDoubleForfeitPod(pod)
          ? m.tournaments_pod_double_forfeit()
          : pairingLabel(match.podNumber)
      }
      aside={
        <>
          {cutMatchShortLabel(context.cutSize, roundNumber, match.podNumber)}
          {canEnter && reported ? (
            <Badge variant="success">{m.tournaments_pod_reported()}</Badge>
          ) : null}
        </>
      }
      footer={
        canEnter && !editor.editing ? (
          <Button
            variant={reported ? "destructive" : "secondary"}
            size="sm"
            onClick={editor.handleStart}
          >
            {reported ? m.tournaments_pod_edit_result() : m.tournaments_pod_enter_result()}
          </Button>
        ) : null
      }
    >
      {seats}
    </BracketMatchCard>
  );
}

export function CutBracketCompact({
  rounds,
  cutSize,
  groupStage,
  entry,
}: {
  rounds: PodRoundResponse[];
  cutSize: CutSize;
  groupStage: GroupStageView;
  entry?: CutBracketEntry;
}) {
  const columns = buildBracketColumns(rounds, cutSize);
  if (!groupStage.cutGenerated) {
    return null;
  }
  const context: SeatContext = {
    cutSize,
    groupByPlayer: groupLabelByPlayer(groupStage.groups),
    seedByPlayer: seedsByPlayer(groupStage),
    legendByPlayer: legendsByPlayer(groupStage),
    placeByPlayer: new Map(
      (groupStage.finalStandings ?? []).map((row) => [row.playerId, row.place] as const),
    ),
  };
  const roundByNumber = new Map(rounds.map((round) => [round.roundNumber, round]));
  const collapsed = collapsedBracketRounds(columns);

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading>{m.tournaments_cut_top_heading({ size: cutSize })}</SectionHeading>
      <BracketColumns columnCount={columns.length}>
        {columns.map((column, index) => (
          <BracketColumn
            key={column.roundNumber}
            label={column.label}
            collapsed={collapsed.has(column.roundNumber) || undefined}
          >
            {column.matches.map((match) => (
              <Match
                key={match.key}
                match={match}
                round={roundByNumber.get(column.roundNumber)}
                roundNumber={column.roundNumber}
                context={context}
                isFinal={index === columns.length - 1}
                entry={entry}
              />
            ))}
          </BracketColumn>
        ))}
      </BracketColumns>
    </section>
  );
}
