import type { CutSize } from "@openrift/shared/pairing/group-cut-types";
import type {
  GroupStageView,
  PodResponse,
  PodRoundResponse,
  PodScoringScheme,
} from "@openrift/shared/types/api/pod-tournament";
import type { TournamentMatchFormat } from "@openrift/shared/types/api/tournament";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { BracketMatch } from "@/features/tournaments/lib/cut-bracket-display";
import {
  buildBracketColumns,
  defaultBracketRound,
  isHigherSeed,
} from "@/features/tournaments/lib/cut-bracket-display";
import { cutMatchShortLabel } from "@/features/tournaments/lib/group-cut-display";
import { groupLabelByPlayer } from "@/features/tournaments/lib/group-cut-units";
import type { PlayerLegend } from "@/features/tournaments/lib/player-run";
import { legendsByPlayer } from "@/features/tournaments/lib/player-run";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { PodCard } from "./pod-card";
import { TournamentLegend } from "./tournament-legend";

interface PodResultEntry {
  playerId: string;
  gamePoints: number;
}

export function CutBracketView({
  rounds,
  cutSize,
  groupStage,
  scheme,
  matchFormat,
  winPoints,
  drawPoints,
  canEnterResult,
  onSubmitResult,
  onSubmitPlayerResult,
  completed = false,
}: {
  rounds: PodRoundResponse[];
  cutSize: CutSize;
  groupStage: GroupStageView;
  scheme: PodScoringScheme;
  matchFormat: TournamentMatchFormat;
  winPoints: number;
  drawPoints: number;
  canEnterResult: (round: PodRoundResponse, pod: PodResponse) => boolean;
  onSubmitResult: (podId: string, results: PodResultEntry[]) => Promise<void>;
  onSubmitPlayerResult?: (podId: string, playerId: string, gamePoints: number) => Promise<void>;
  completed?: boolean;
}) {
  const columns = buildBracketColumns(rounds, cutSize);
  const [pickedRound, setPickedRound] = useState<number | null>(null);
  const selectedRound = pickedRound ?? defaultBracketRound(columns, rounds, completed);
  const seedByPlayer = new Map(
    groupStage.ranking.flatMap((row) => (row.seed === null ? [] : [[row.playerId, row.seed]])),
  );
  const groupByPlayer = groupLabelByPlayer(groupStage.groups);
  const legendByPlayer = legendsByPlayer(groupStage);
  const roundByNumber = new Map(rounds.map((round) => [round.roundNumber, round]));

  return (
    <div data-slot="cut-bracket-list" className="flex flex-col gap-3 md:overflow-x-auto">
      {columns.length > 1 ? (
        <ToggleGroup
          variant="outline"
          size="sm"
          aria-label={m.tournaments_cut_round_picker_aria()}
          className="flex-wrap md:hidden"
          value={selectedRound === undefined ? [] : [String(selectedRound)]}
          onValueChange={(next) => {
            const value = next[0];
            if (value !== undefined) {
              setPickedRound(Number(value));
            }
          }}
        >
          {columns.map((column) => (
            <ToggleGroupItem key={column.roundNumber} value={String(column.roundNumber)}>
              {column.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : null}
      <div className="flex flex-col gap-4 md:min-w-max md:flex-row md:items-start">
        {columns.map((column) => {
          const round = roundByNumber.get(column.roundNumber);
          return (
            <div
              key={column.roundNumber}
              data-slot="cut-bracket-round"
              className={cn(
                "flex-col gap-3 md:flex md:w-72 md:shrink-0",
                column.roundNumber === selectedRound ? "flex" : "hidden",
              )}
            >
              <SectionHeading as="h3" size="sm" className="hidden md:block">
                {column.label}
              </SectionHeading>
              {column.matches.map((match) => {
                const pod = match.pod;
                if (pod === null || round === undefined) {
                  return (
                    <PlaceholderMatch
                      key={match.key}
                      label={m.tournaments_cut_match_table_label({
                        match: cutMatchShortLabel(cutSize, column.roundNumber, match.podNumber),
                        number: match.podNumber,
                      })}
                      match={match}
                    />
                  );
                }
                return (
                  <PodCard
                    key={match.key}
                    pod={pod}
                    teamMode={false}
                    scheme={scheme}
                    matchFormat={matchFormat}
                    winPoints={winPoints}
                    drawPoints={drawPoints}
                    showPenalty={false}
                    warnings={[]}
                    warningsExpanded={false}
                    nameById={new Map()}
                    canEnter={canEnterResult(round, pod)}
                    layout="stacked"
                    title={m.tournaments_cut_match_table_label({
                      match: cutMatchShortLabel(cutSize, column.roundNumber, match.podNumber),
                      number: match.podNumber,
                    })}
                    renderMemberLeading={(playerId) => (
                      <SeedPill seed={seedByPlayer.get(playerId)} />
                    )}
                    renderMemberBadge={(playerId) => (
                      <MemberNotes
                        groupLabel={groupByPlayer.get(playerId)}
                        legend={legendByPlayer.get(playerId)}
                        chooser={
                          pod.resultStatus !== "reported" &&
                          isHigherSeed(pod, playerId, seedByPlayer)
                        }
                      />
                    )}
                    onSubmit={onSubmitResult}
                    onSubmitPlayerResult={onSubmitPlayerResult}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SeedPill({ seed }: { seed: number | undefined }) {
  if (seed === undefined) {
    return null;
  }
  return (
    <Badge variant="outline" className="shrink-0 tabular-nums">
      #{seed}
    </Badge>
  );
}

function MemberNotes({
  groupLabel,
  legend,
  chooser,
}: {
  groupLabel: string | undefined;
  legend: PlayerLegend | undefined;
  chooser: boolean;
}) {
  return (
    <>
      {legend ? (
        <TournamentLegend
          legendCardId={legend.legendCardId}
          fallback={legend}
          championOnly
          className="text-muted-foreground shrink-0 text-xs"
        />
      ) : null}
      {groupLabel ? (
        <Badge variant="neutral" className="shrink-0">
          {groupLabel}
        </Badge>
      ) : null}
      {chooser ? (
        <span className="text-muted-foreground shrink-0 text-xs">
          {m.tournaments_cut_chooses_starter()}
        </span>
      ) : null}
    </>
  );
}

function PlaceholderMatch({ label, match }: { label: string; match: BracketMatch }) {
  return (
    <Card className="gap-2 border-dashed">
      <CardHeader className="gap-1">
        <CardTitle className="text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground flex flex-col gap-1 text-sm">
        {match.feeders ? (
          match.feeders.map((feeder) => (
            <span key={feeder}>{m.tournaments_cut_winner_of({ match: feeder })}</span>
          ))
        ) : (
          <span>{m.tournaments_cut_not_drawn_yet()}</span>
        )}
      </CardContent>
    </Card>
  );
}
