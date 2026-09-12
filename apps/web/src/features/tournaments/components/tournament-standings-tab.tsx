import type { CutSize } from "@openrift/shared/pairing/group-cut-types";
import type {
  GroupStageView,
  LegendMetaShareView,
  PodRoundResponse,
  PodStandingRow,
  PodTournamentDetailResponse,
} from "@openrift/shared/types/api/pod-tournament";
import type {
  TournamentDetailResponse,
  TournamentPlayMode,
} from "@openrift/shared/types/api/tournament";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { CutBracketCompact } from "@/features/tournaments/components/cut-bracket-compact";
import {
  FinalStandingsCard,
  FinalStandingsPodium,
} from "@/features/tournaments/components/final-standings-card";
import { GroupCutStandings } from "@/features/tournaments/components/group-cut-standings";
import { RegionOverview } from "@/features/tournaments/components/region-overview";
import { StandingsPodium } from "@/features/tournaments/components/standings-podium";
import {
  snapshotRound,
  StandingsRoundPicker,
} from "@/features/tournaments/components/standings-round-picker";
import { StandingsTable } from "@/features/tournaments/components/standings-table";
import { TournamentLegendFinishes } from "@/features/tournaments/components/tournament-legend-finishes";
import {
  useStandingsSnapshot,
  useTournamentRunState,
} from "@/features/tournaments/hooks/use-tournament-run";
import {
  bestFinishPerLegend,
  latestSnapshotRound,
  legendsByPlayer,
} from "@/features/tournaments/lib/player-run";
import { isTournamentStaff } from "@/features/tournaments/lib/tournament-display";
import { useRegionLabel } from "@/hooks/use-region-label";

import { rankedStandings } from "./standings-display";

type Tournament = PodTournamentDetailResponse["tournament"];

/** The group cut standings page for one state of the tournament, live or a snapshot. */
export function GroupCutStandingsView({
  cutSize,
  legendTiebreak,
  groupStage,
  rounds,
  standings,
  legendCardByPlayer,
  metaShares,
  live,
}: {
  cutSize: CutSize;
  legendTiebreak: boolean;
  groupStage: GroupStageView;
  rounds: PodRoundResponse[];
  standings: PodStandingRow[];
  legendCardByPlayer: ReadonlyMap<string, string | null>;
  /** Staff only, live view only: enables the meta-share dialog. */
  metaShares?: { id: string; shares: LegendMetaShareView[] };
  live: boolean;
}) {
  const finalRows = groupStage.finalStandings;
  const legendByPlayer = legendsByPlayer(groupStage);
  return (
    <>
      {finalRows === null ? null : (
        <FinalStandingsPodium rows={finalRows} standings={standings} cutSize={cutSize} />
      )}
      <CutBracketCompact rounds={rounds} cutSize={cutSize} groupStage={groupStage} />
      {finalRows === null ? null : (
        <>
          {live ? (
            <TournamentLegendFinishes
              entries={bestFinishPerLegend(finalRows, legendCardByPlayer)}
            />
          ) : null}
          <FinalStandingsCard
            rows={finalRows}
            cutSize={cutSize}
            rounds={rounds}
            legendByPlayer={legendByPlayer}
          />
        </>
      )}
      <GroupCutStandings
        groupStage={groupStage}
        cutSize={cutSize}
        legendTiebreak={legendTiebreak}
        metaShares={live ? metaShares : undefined}
      />
    </>
  );
}

function SnapshotStandings({
  id,
  round,
  tournament,
  regionLabel,
  legendCardByPlayer,
}: {
  id: string;
  round: number;
  tournament: Tournament;
  regionLabel: (slug: string) => string;
  legendCardByPlayer: ReadonlyMap<string, string | null>;
}) {
  const { data } = useStandingsSnapshot(id, round);
  if (tournament.format === "group_cut" && data.groupStage !== null) {
    return (
      <GroupCutStandingsView
        cutSize={tournament.cutSize}
        legendTiebreak={tournament.legendTiebreak}
        groupStage={data.groupStage}
        rounds={data.rounds}
        standings={data.standings}
        legendCardByPlayer={legendCardByPlayer}
        live={false}
      />
    );
  }
  const variant: "pod" | "swiss" = tournament.pairingStyle === "swiss" ? "swiss" : "pod";
  const playMode: TournamentPlayMode = tournament.playMode;
  return (
    <>
      <StandingsPodium standings={data.standings} variant={variant} playMode={playMode} />
      <StandingsTable
        standings={data.standings}
        variant={variant}
        playMode={playMode}
        regionsEnabled={tournament.regionsEnabled}
        regionLabel={regionLabel}
        rounds={data.rounds}
        legendByPlayer={legendCardByPlayer}
      />
    </>
  );
}

export function TournamentStandingsTab({
  id,
  detail,
  round: requestedRound,
}: {
  id: string;
  detail: TournamentDetailResponse;
  /** From the `round` search param: show the table as it stood after that round. */
  round?: number;
}) {
  const { data } = useTournamentRunState(id);
  const regionLabel = useRegionLabel();
  const navigate = useNavigate();
  const tournament = data.tournament;
  const variant = tournament.pairingStyle === "swiss" ? "swiss" : "pod";
  const groupStage = data.groupStage;
  const groupCut = tournament.format === "group_cut" && groupStage !== null;
  const completed = tournament.status === "completed";
  const legendCardByPlayer = new Map(
    data.players.map((player) => [player.id, player.legendCardId] as const),
  );
  const latestRound = latestSnapshotRound(data.rounds, groupCut);
  const snapshot = snapshotRound(requestedRound, latestRound);
  const pickRound = (round: number | null) =>
    void navigate({
      to: "/tournaments/$id/standings",
      params: { id },
      search: round === null ? {} : { round },
    });

  let body: ReactNode;
  if (snapshot !== null) {
    body = (
      <SnapshotStandings
        id={id}
        round={snapshot}
        tournament={tournament}
        regionLabel={regionLabel}
        legendCardByPlayer={legendCardByPlayer}
      />
    );
  } else if (groupCut) {
    body = (
      <GroupCutStandingsView
        cutSize={tournament.cutSize}
        legendTiebreak={tournament.legendTiebreak}
        groupStage={groupStage}
        rounds={data.rounds}
        standings={data.standings}
        legendCardByPlayer={legendCardByPlayer}
        metaShares={
          isTournamentStaff(detail.myRoles) ? { id, shares: data.legendMetaShares } : undefined
        }
        live
      />
    );
  } else {
    body = (
      <>
        <StandingsPodium
          standings={data.standings}
          variant={variant}
          playMode={tournament.playMode}
        />
        {completed ? (
          <TournamentLegendFinishes
            entries={bestFinishPerLegend(
              rankedStandings(data.standings).map(({ row, rank }) => ({
                playerId: row.playerId,
                displayName: row.displayName,
                place: rank,
              })),
              legendCardByPlayer,
            )}
          />
        ) : null}
        <StandingsTable
          standings={data.standings}
          variant={variant}
          playMode={tournament.playMode}
          regionsEnabled={tournament.regionsEnabled}
          regionLabel={regionLabel}
          rounds={data.rounds}
          legendByPlayer={legendCardByPlayer}
        />
        {tournament.regionsEnabled ? (
          <RegionOverview standings={data.standings} regionLabel={regionLabel} />
        ) : null}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <StandingsRoundPicker latestRound={latestRound} selected={snapshot} onSelect={pickRound} />
      {body}
    </div>
  );
}
