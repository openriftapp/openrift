import type { PodReportResponse } from "@openrift/shared/types/api/pod-tournament";
import { toast } from "sonner";

import {
  useStartReportGroupRound,
  useSubmitTournamentReportPlayerResult,
  useSubmitTournamentReportResult,
} from "@/features/tournaments/hooks/use-tournament-run";
import { cutRounds } from "@/features/tournaments/lib/cut-bracket-display";
import { useRegionLabel } from "@/hooks/use-region-label";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

import { CutBracketCompact } from "./cut-bracket-compact";
import { CutBracketView } from "./cut-bracket-view";
import { GroupStageSections } from "./group-stage-sections";
import { PairingsView } from "./pairings-view";

export function ReportRoundsContent({ token, data }: { token: string; data: PodReportResponse }) {
  const submitResult = useSubmitTournamentReportResult(token);
  const submitPlayerResult = useSubmitTournamentReportPlayerResult(token);
  const startGroupRound = useStartReportGroupRound(token);
  const regionLabel = useRegionLabel();
  const regionByPlayer = data.regionsEnabled
    ? new Map(data.standings.map((row) => [row.playerId, row.region]))
    : undefined;
  const swiss = data.pairingStyle === "swiss";
  const hasOpenRound = data.rounds.some((round) => round.status === "reporting");
  const canSubmit = data.canSubmit;
  const groupStage = data.groupStage;

  async function submit(podId: string, results: { playerId: string; gamePoints: number }[]) {
    try {
      await submitResult.mutateAsync({ podId, results });
      toast.success(m.tournaments_report_result_submitted());
    } catch {
      // Reported by the global mutation error toast.
    }
  }

  async function submitPlayer(podId: string, playerId: string, gamePoints: number) {
    try {
      await submitPlayerResult.mutateAsync({ podId, playerId, gamePoints });
      toast.success(m.tournaments_report_score_saved());
    } catch {
      // Reported by the global mutation error toast.
    }
  }

  if (data.format === "group_cut" && groupStage !== null && groupStage.groups.length > 0) {
    const bracketRounds = cutRounds(data.rounds);
    return (
      <div className="flex flex-col gap-6">
        {canSubmit ? (
          <p className="text-muted-foreground text-sm">{m.tournaments_report_enter_games_won()}</p>
        ) : null}
        {bracketRounds.length > 0 && !canSubmit ? (
          <CutBracketCompact
            rounds={bracketRounds}
            cutSize={data.cutSize}
            groupStage={groupStage}
          />
        ) : bracketRounds.length > 0 ? (
          <CutBracketView
            rounds={bracketRounds}
            cutSize={data.cutSize}
            groupStage={groupStage}
            scheme={data.scoringScheme}
            matchFormat={data.matchFormat}
            winPoints={data.winPoints}
            drawPoints={data.drawPoints}
            canEnterResult={(round) => canSubmit && round.status === "reporting"}
            onSubmitResult={submit}
            onSubmitPlayerResult={canSubmit ? submitPlayer : undefined}
          />
        ) : null}
        <GroupStageSections
          groupStage={groupStage}
          rounds={data.rounds}
          scheme={data.scoringScheme}
          matchFormat={data.matchFormat}
          winPoints={data.winPoints}
          drawPoints={data.drawPoints}
          canEnterResult={canSubmit}
          onSubmitResult={submit}
          onSubmitPlayerResult={canSubmit ? submitPlayer : undefined}
          onStartUnit={
            canSubmit && data.groupsSelfPaced
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
      {hasOpenRound && canSubmit ? (
        <p className="text-muted-foreground text-sm">
          {data.playMode === "2v2"
            ? m.tournaments_report_enter_team_games_won()
            : swiss
              ? m.tournaments_report_enter_games_won()
              : m.tournaments_report_enter_game_points()}
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
        regionLabel={regionLabel}
        showPenalty={false}
        canEnterResult={(round) => canSubmit && round.status === "reporting"}
        onSubmitResult={submit}
        onSubmitPlayerResult={canSubmit ? submitPlayer : undefined}
        emptyMessage={m.tournaments_report_no_rounds()}
      />
    </div>
  );
}
