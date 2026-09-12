import { GROUP_STAGE_ROUNDS } from "@openrift/shared/pairing/group-cut-types";
import type {
  GroupStageView,
  PodResponse,
  PodRoundResponse,
  PodScoringScheme,
} from "@openrift/shared/types/api/pod-tournament";
import type { TournamentMatchFormat } from "@openrift/shared/types/api/tournament";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import { SectionHeading } from "@/components/ui/section-heading";
import { groupStageRounds } from "@/features/tournaments/lib/cut-bracket-display";
import type { GroupUnit } from "@/features/tournaments/lib/group-cut-units";
import {
  groupLabelByPlayer,
  groupUnits,
  isCrossGroupPod,
  podsOfUnit,
  roundSummaryLine,
  unitReportProgress,
} from "@/features/tournaments/lib/group-cut-units";
import type { PlayerLegend } from "@/features/tournaments/lib/player-run";
import { legendsByPlayer } from "@/features/tournaments/lib/player-run";

import { PodCard } from "./pod-card";
import { StartGroupRoundButton } from "./start-group-round-button";
import { TournamentLegend } from "./tournament-legend";

interface PodResultEntry {
  playerId: string;
  gamePoints: number;
}

interface GroupStageSectionsProps {
  groupStage: GroupStageView;
  rounds: PodRoundResponse[];
  scheme: PodScoringScheme;
  matchFormat: TournamentMatchFormat;
  winPoints: number;
  drawPoints: number;
  canEnterResult: boolean;
  onSubmitResult: (podId: string, results: PodResultEntry[]) => Promise<void>;
  onSubmitPlayerResult?: (podId: string, playerId: string, gamePoints: number) => Promise<void>;
  /** Absent when the viewer cannot start a group's round. */
  onStartUnit?: (unit: GroupUnit) => void;
  starting?: boolean;
}

export function GroupStageSections({
  groupStage,
  rounds,
  scheme,
  matchFormat,
  winPoints,
  drawPoints,
  canEnterResult,
  onSubmitResult,
  onSubmitPlayerResult,
  onStartUnit,
  starting = false,
}: GroupStageSectionsProps) {
  const units = groupUnits(groupStage.groups);
  const labelByPlayer = groupLabelByPlayer(groupStage.groups);
  const legendByPlayer = legendsByPlayer(groupStage);
  const stageRounds = groupStageRounds(rounds);
  const canEditEarlier = canEnterResult && !groupStage.cutGenerated;

  if (units.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-8">
      {units.map((unit) => (
        <GroupUnitSection
          key={unit.key}
          unit={unit}
          rounds={stageRounds}
          labelByPlayer={labelByPlayer}
          legendByPlayer={legendByPlayer}
          scheme={scheme}
          matchFormat={matchFormat}
          winPoints={winPoints}
          drawPoints={drawPoints}
          canEnterResult={canEnterResult}
          canEditEarlier={canEditEarlier}
          onSubmitResult={onSubmitResult}
          onSubmitPlayerResult={onSubmitPlayerResult}
          onStartUnit={onStartUnit}
          starting={starting}
        />
      ))}
    </div>
  );
}

function UnitProgressBadge({
  unit,
  reported,
  total,
}: {
  unit: GroupUnit;
  reported: number;
  total: number;
}) {
  if (unit.done) {
    return <Badge variant="success">Done</Badge>;
  }
  if (unit.roundsStarted === 0) {
    return <Badge variant="muted">Not started</Badge>;
  }
  return (
    <Badge variant={reported === total ? "success" : "warning"}>
      Round {unit.roundsStarted} · {reported} of {total} in
    </Badge>
  );
}

function GroupUnitSection({
  unit,
  rounds,
  labelByPlayer,
  legendByPlayer,
  scheme,
  matchFormat,
  winPoints,
  drawPoints,
  canEnterResult,
  canEditEarlier,
  onSubmitResult,
  onSubmitPlayerResult,
  onStartUnit,
  starting,
}: {
  unit: GroupUnit;
  rounds: PodRoundResponse[];
  labelByPlayer: Map<string, string>;
  legendByPlayer: Map<string, PlayerLegend>;
  scheme: PodScoringScheme;
  matchFormat: TournamentMatchFormat;
  winPoints: number;
  drawPoints: number;
  canEnterResult: boolean;
  canEditEarlier: boolean;
  onSubmitResult: (podId: string, results: PodResultEntry[]) => Promise<void>;
  onSubmitPlayerResult?: (podId: string, playerId: string, gamePoints: number) => Promise<void>;
  onStartUnit?: (unit: GroupUnit) => void;
  starting: boolean;
}) {
  const currentRound = rounds.find((round) => round.roundNumber === unit.roundsStarted);
  const currentPods = currentRound ? podsOfUnit(currentRound, unit) : [];
  const progress = unitReportProgress(currentPods);
  const missing = progress.total - progress.reported;
  const earlier = rounds
    .filter((round) => round.roundNumber < unit.roundsStarted)
    .map((round) => ({ roundNumber: round.roundNumber, pods: podsOfUnit(round, unit) }))
    .filter((entry) => entry.pods.length > 0);
  const nextRound = unit.roundsStarted + 1;
  const showStart = onStartUnit !== undefined && !unit.done && nextRound <= GROUP_STAGE_ROUNDS;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SectionHeading as="h3">{unit.label}</SectionHeading>
          <UnitProgressBadge unit={unit} reported={progress.reported} total={progress.total} />
          {unit.paired ? <Badge variant="outline">One cross-group match each</Badge> : null}
        </div>
        {showStart ? (
          unit.canStartNextRound ? (
            <StartGroupRoundButton
              roundNumber={nextRound}
              scopeLabel={unit.label}
              disabled={false}
              pending={starting}
              onConfirm={() => onStartUnit(unit)}
            />
          ) : (
            <span className="text-muted-foreground text-sm">
              {missing} result{missing === 1 ? "" : "s"} missing
            </span>
          )
        ) : null}
      </div>
      {currentPods.length > 0 ? (
        <div className="flex flex-col gap-3">
          <span className="text-muted-foreground text-sm">Round {unit.roundsStarted}</span>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {currentPods.map((pod) => (
              <PodCard
                key={pod.id}
                pod={pod}
                teamMode={false}
                scheme={scheme}
                matchFormat={matchFormat}
                winPoints={winPoints}
                drawPoints={drawPoints}
                regionLabel={rawSlug}
                showPenalty={false}
                warnings={[]}
                warningsExpanded={false}
                nameById={podNames(currentPods)}
                canEnter={canEnterResult}
                crossGroup={isCrossGroupPod(pod, labelByPlayer)}
                renderMemberBadge={(playerId) => (
                  <MemberLegend legend={legendByPlayer.get(playerId)} />
                )}
                onSubmit={onSubmitResult}
                onSubmitPlayerResult={onSubmitPlayerResult}
              />
            ))}
          </div>
        </div>
      ) : null}
      {earlier.map((entry) => (
        <EarlierRound
          key={entry.roundNumber}
          roundNumber={entry.roundNumber}
          pods={entry.pods}
          labelByPlayer={labelByPlayer}
          legendByPlayer={legendByPlayer}
          scheme={scheme}
          matchFormat={matchFormat}
          winPoints={winPoints}
          drawPoints={drawPoints}
          canEnter={canEditEarlier}
          onSubmitResult={onSubmitResult}
          onSubmitPlayerResult={onSubmitPlayerResult}
        />
      ))}
    </section>
  );
}

function EarlierRound({
  roundNumber,
  pods,
  labelByPlayer,
  legendByPlayer,
  scheme,
  matchFormat,
  winPoints,
  drawPoints,
  canEnter,
  onSubmitResult,
  onSubmitPlayerResult,
}: {
  roundNumber: number;
  pods: PodResponse[];
  labelByPlayer: Map<string, string>;
  legendByPlayer: Map<string, PlayerLegend>;
  scheme: PodScoringScheme;
  matchFormat: TournamentMatchFormat;
  winPoints: number;
  drawPoints: number;
  canEnter: boolean;
  onSubmitResult: (podId: string, results: PodResultEntry[]) => Promise<void>;
  onSubmitPlayerResult?: (podId: string, playerId: string, gamePoints: number) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <ExpandToggle
        expanded={expanded}
        aria-label={`${expanded ? "Collapse" : "Expand"} round ${roundNumber}`}
        className="text-muted-foreground max-w-full text-sm"
        onClick={() => {
          setExpanded((open) => !open);
        }}
      >
        <span className="truncate">{roundSummaryLine(roundNumber, pods)}</span>
      </ExpandToggle>
      {expanded ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pods.map((pod) => (
            <PodCard
              key={pod.id}
              pod={pod}
              teamMode={false}
              scheme={scheme}
              matchFormat={matchFormat}
              winPoints={winPoints}
              drawPoints={drawPoints}
              regionLabel={rawSlug}
              showPenalty={false}
              warnings={[]}
              warningsExpanded={false}
              nameById={podNames(pods)}
              canEnter={canEnter}
              crossGroup={isCrossGroupPod(pod, labelByPlayer)}
              renderMemberBadge={(playerId) => (
                <MemberLegend legend={legendByPlayer.get(playerId)} />
              )}
              onSubmit={onSubmitResult}
              onSubmitPlayerResult={onSubmitPlayerResult}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MemberLegend({ legend }: { legend: PlayerLegend | undefined }) {
  if (legend === undefined) {
    return null;
  }
  return (
    <TournamentLegend
      legendCardId={legend.legendCardId}
      legendName={legend.legendName}
      championOnly
      className="text-muted-foreground shrink-0 text-xs"
    />
  );
}

// Named module-level default: an inline arrow makes the React Compiler bail.
const rawSlug = (slug: string): string => slug;

function podNames(pods: readonly PodResponse[]): Map<string, string> {
  return new Map(
    pods.flatMap((pod) => pod.members.map((member) => [member.playerId, member.displayName])),
  );
}
