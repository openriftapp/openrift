import type { PodReportResponse } from "@openrift/shared/types/api/pod-tournament";
import { useNavigate, getRouteApi } from "@tanstack/react-router";

import { StandingsBody } from "@/features/tournaments/components/standings-body";
import {
  snapshotRound,
  StandingsRoundPicker,
} from "@/features/tournaments/components/standings-round-picker";
import { TournamentReportFrame } from "@/features/tournaments/components/tournament-shell";
import { useReportStandingsSnapshot } from "@/features/tournaments/hooks/use-tournament-run";
import { latestSnapshotRound } from "@/features/tournaments/lib/player-run";
import { isGroupCutStandings } from "@/features/tournaments/lib/standings-display";

const routeApi = getRouteApi("/_app/tournaments_/report/$token_/standings");

function ReportSnapshot({
  token,
  round,
  report,
  legendCardByPlayer,
}: {
  token: string;
  round: number;
  report: PodReportResponse;
  legendCardByPlayer: ReadonlyMap<string, string | null>;
}) {
  const { data } = useReportStandingsSnapshot(token, round);
  return (
    <StandingsBody
      format={report.format}
      cutSize={report.cutSize}
      legendTiebreak={report.legendTiebreak}
      pairingStyle={report.pairingStyle}
      playMode={report.playMode}
      regionsEnabled={report.regionsEnabled}
      standings={data.standings}
      rounds={data.rounds}
      groupStage={data.groupStage}
      legendCardByPlayer={legendCardByPlayer}
      live={false}
      completed={report.status === "completed"}
    />
  );
}

export function ReportStandingsPage() {
  const { token } = routeApi.useParams();
  const { round: requestedRound } = routeApi.useSearch();
  const navigate = useNavigate();
  return (
    <TournamentReportFrame
      token={token}
      active="standings"
      render={(data) => {
        const latestRound = latestSnapshotRound(
          data.rounds,
          isGroupCutStandings(data.format, data.groupStage),
        );
        const snapshot = snapshotRound(requestedRound, latestRound);
        const legendCardByPlayer = new Map(
          data.playerLegends.map((legend) => [legend.playerId, legend.legendCardId] as const),
        );
        const pickRound = (round: number | null) =>
          void navigate({
            to: "/tournaments/report/$token/standings",
            params: { token },
            search: round === null ? {} : { round },
          });
        return (
          <div className="flex flex-col gap-6">
            <StandingsRoundPicker
              latestRound={latestRound}
              selected={snapshot}
              onSelect={pickRound}
            />
            {snapshot === null ? (
              <StandingsBody
                format={data.format}
                cutSize={data.cutSize}
                legendTiebreak={data.legendTiebreak}
                pairingStyle={data.pairingStyle}
                playMode={data.playMode}
                regionsEnabled={data.regionsEnabled}
                standings={data.standings}
                rounds={data.rounds}
                groupStage={data.groupStage}
                legendCardByPlayer={legendCardByPlayer}
                live
                completed={data.status === "completed"}
              />
            ) : (
              <ReportSnapshot
                token={token}
                round={snapshot}
                report={data}
                legendCardByPlayer={legendCardByPlayer}
              />
            )}
          </div>
        );
      }}
    />
  );
}
