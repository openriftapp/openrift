import { cutRounds } from "@openrift/shared/pairing/group-cut-rounds";
import type { PodReportResponse } from "@openrift/shared/types/api/pod-tournament";

import {
  useStartReportGroupRound,
  useSubmitTournamentReportPlayerResult,
  useSubmitTournamentReportResult,
} from "@/features/tournaments/hooks/use-tournament-run";
import { legendsByCardId } from "@/features/tournaments/lib/player-run";
import type { PodResultSubmission } from "@/features/tournaments/lib/swiss-results";
import {
  isMatchPairing,
  reportAcceptsResults,
  reportCanEdit,
} from "@/features/tournaments/lib/tournament-display";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

import { CutBracketCompact } from "./cut-bracket-compact";
import { GroupStageSections } from "./group-stage-sections";
import { PairingsView } from "./pairings-view";

export function ReportRoundsContent({ token, data }: { token: string; data: PodReportResponse }) {
  const submitResult = useSubmitTournamentReportResult(token);
  const submitPlayerResult = useSubmitTournamentReportPlayerResult(token);
  const startGroupRound = useStartReportGroupRound(token);
  const regionByPlayer = data.regionsEnabled
    ? new Map(data.standings.map((row) => [row.playerId, row.region]))
    : undefined;
  const swiss = data.pairingStyle === "swiss";
  const showEntryHint = reportAcceptsResults(data);
  const canEdit = reportCanEdit(data);
  const hasOpenMatchTable = data.rounds.some(
    (round) => round.status === "reporting" && round.pods.some((pod) => isMatchPairing(pod.size)),
  );
  const groupStage = data.groupStage;

  const submit = (podId: string, submission: PodResultSubmission) =>
    submitResult.mutateAsync({ podId, ...submission });
  const submitPlayer = (podId: string, playerId: string, gamePoints: number) =>
    submitPlayerResult.mutateAsync({ podId, playerId, gamePoints });

  if (data.format === "group_cut" && groupStage !== null && groupStage.groups.length > 0) {
    const bracketRounds = cutRounds(data.rounds, (round) => round.roundNumber);
    return (
      <div className="flex flex-col gap-6">
        {showEntryHint ? (
          <p className="text-muted-foreground text-sm">
            {m.tournaments_report_enter_match_result()}
          </p>
        ) : null}
        {bracketRounds.length > 0 ? (
          <CutBracketCompact
            rounds={bracketRounds}
            cutSize={data.cutSize}
            groupStage={groupStage}
            entry={
              canEdit && data.status !== "completed"
                ? {
                    matchFormat: data.matchFormat,
                    winPoints: data.winPoints,
                    drawPoints: data.drawPoints,
                    canEnterResult: (round) => round.status === "reporting",
                    onSubmitResult: submit,
                  }
                : undefined
            }
          />
        ) : null}
        <GroupStageSections
          groupStage={groupStage}
          rounds={data.rounds}
          scheme={data.scoringScheme}
          matchFormat={data.matchFormat}
          winPoints={data.winPoints}
          drawPoints={data.drawPoints}
          canEnterResult={canEdit}
          onSubmitResult={submit}
          onSubmitPlayerResult={canEdit ? submitPlayer : undefined}
          onStartUnit={
            canEdit && data.groupsSelfPaced
              ? (unit) =>
                  void runReportedMutation(() =>
                    startGroupRound.mutateAsync({ groupId: unit.groups[0]?.id ?? "" }),
                  )
              : undefined
          }
          starting={startGroupRound.isPending}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {showEntryHint ? (
        <p className="text-muted-foreground text-sm">
          {data.playMode === "2v2" || swiss
            ? m.tournaments_report_enter_match_result()
            : m.tournaments_report_enter_game_points()}
          {hasOpenMatchTable && data.playMode !== "2v2" && !swiss
            ? ` ${m.tournaments_report_match_table_hint()}`
            : null}
        </p>
      ) : null}
      <PairingsView
        rounds={data.rounds}
        playMode={data.playMode}
        scheme={data.scoringScheme}
        byePoints={data.byePoints}
        matchFormat={data.matchFormat}
        winPoints={data.winPoints}
        drawPoints={data.drawPoints}
        regionByPlayer={regionByPlayer}
        legendByPlayer={legendsByCardId(data.playerLegends)}
        showPenalty={false}
        canEnterResult={(round) => canEdit && round.status === "reporting"}
        onSubmitResult={submit}
        onSubmitPlayerResult={canEdit ? submitPlayer : undefined}
        emptyMessage={m.tournaments_report_no_rounds()}
      />
    </div>
  );
}
