import type { PodReportResponse } from "@openrift/shared/types/api/pod-tournament";
import type { TournamentPlayMode } from "@openrift/shared/types/api/tournament";
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";

import { RegionOverview } from "@/features/tournaments/components/region-overview";
import { StandingsPodium } from "@/features/tournaments/components/standings-podium";
import {
  snapshotRound,
  StandingsRoundPicker,
} from "@/features/tournaments/components/standings-round-picker";
import { StandingsTable } from "@/features/tournaments/components/standings-table";
import { TournamentReportFrame } from "@/features/tournaments/components/tournament-shell";
import { GroupCutStandingsView } from "@/features/tournaments/components/tournament-standings-tab";
import { useReportStandingsSnapshot } from "@/features/tournaments/hooks/use-tournament-run";
import { latestSnapshotRound } from "@/features/tournaments/lib/player-run";
import { useRegionLabel } from "@/hooks/use-region-label";

export const Route = createLazyFileRoute("/_app/tournaments_/report/$token_/standings")({
  component: ReportStandingsRoute,
});

function ReportSnapshot({
  token,
  round,
  report,
  variant,
  playMode,
  regionsEnabled,
  regionLabel,
}: {
  token: string;
  round: number;
  report: PodReportResponse;
  variant: "pod" | "swiss";
  playMode: TournamentPlayMode;
  regionsEnabled: boolean;
  regionLabel: (slug: string) => string;
}) {
  const { data } = useReportStandingsSnapshot(token, round);
  if (report.format === "group_cut" && data.groupStage !== null) {
    return (
      <GroupCutStandingsView
        cutSize={report.cutSize}
        legendTiebreak={report.legendTiebreak}
        groupStage={data.groupStage}
        rounds={data.rounds}
        standings={data.standings}
        legendCardByPlayer={new Map()}
        live={false}
      />
    );
  }
  return (
    <>
      <StandingsPodium standings={data.standings} variant={variant} playMode={playMode} />
      <StandingsTable
        standings={data.standings}
        variant={variant}
        playMode={playMode}
        regionsEnabled={regionsEnabled}
        regionLabel={regionLabel}
      />
    </>
  );
}

function ReportStandingsRoute() {
  const { token } = Route.useParams();
  const { round: requestedRound } = Route.useSearch();
  const navigate = useNavigate();
  const regionLabel = useRegionLabel();
  return (
    <TournamentReportFrame
      token={token}
      active="standings"
      render={(data) => {
        const variant = data.pairingStyle === "swiss" ? "swiss" : "pod";
        const groupStage = data.groupStage;
        const groupCut =
          data.format === "group_cut" && groupStage !== null && groupStage.groups.length > 0;
        const latestRound = latestSnapshotRound(data.rounds, groupCut);
        const snapshot = snapshotRound(requestedRound, latestRound);
        const pickRound = (round: number | null) =>
          void navigate({
            to: "/tournaments/report/$token/standings",
            params: { token },
            search: round === null ? {} : { round },
          });
        if (snapshot !== null) {
          return (
            <div className="flex flex-col gap-6">
              <StandingsRoundPicker
                latestRound={latestRound}
                selected={snapshot}
                onSelect={pickRound}
              />
              <ReportSnapshot
                token={token}
                round={snapshot}
                report={data}
                variant={variant}
                playMode={data.playMode}
                regionsEnabled={data.regionsEnabled}
                regionLabel={regionLabel}
              />
            </div>
          );
        }
        if (groupCut) {
          return (
            <div className="flex flex-col gap-6">
              <StandingsRoundPicker
                latestRound={latestRound}
                selected={null}
                onSelect={pickRound}
              />
              <GroupCutStandingsView
                cutSize={data.cutSize}
                legendTiebreak={data.legendTiebreak}
                groupStage={groupStage}
                rounds={data.rounds}
                standings={data.standings}
                legendCardByPlayer={new Map()}
                live
              />
            </div>
          );
        }
        return (
          <div className="flex flex-col gap-6">
            <StandingsRoundPicker latestRound={latestRound} selected={null} onSelect={pickRound} />
            <StandingsPodium
              standings={data.standings}
              variant={variant}
              playMode={data.playMode}
            />
            <StandingsTable
              standings={data.standings}
              variant={variant}
              playMode={data.playMode}
              regionsEnabled={data.regionsEnabled}
              regionLabel={regionLabel}
            />
            {data.regionsEnabled ? (
              <RegionOverview standings={data.standings} regionLabel={regionLabel} />
            ) : null}
          </div>
        );
      }}
    />
  );
}
