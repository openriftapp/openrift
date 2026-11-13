import type { CutSize } from "@openrift/shared/pairing/group-cut-types";
import type {
  FinalStandingRow,
  GroupStageView,
  LegendMetaShareView,
  PodReportResponse,
  PodRoundResponse,
  PodStandingRow,
} from "@openrift/shared/types/api/pod-tournament";

import { CutBracketCompact } from "@/features/tournaments/components/cut-bracket-compact";
import {
  FinalStandingsCard,
  FinalStandingsPodium,
} from "@/features/tournaments/components/final-standings-card";
import { GroupCutStandings } from "@/features/tournaments/components/group-cut-standings";
import { RegionOverview } from "@/features/tournaments/components/region-overview";
import { StandingsPodium } from "@/features/tournaments/components/standings-podium";
import { StandingsTable } from "@/features/tournaments/components/standings-table";
import { TournamentLegendFinishes } from "@/features/tournaments/components/tournament-legend-finishes";
import { bestFinishPerLegend, legendsByPlayer } from "@/features/tournaments/lib/player-run";
import {
  formatPlayerRecord,
  isGroupCutStandings,
  rankedStandings,
  standingsVariant,
} from "@/features/tournaments/lib/standings-display";

function finalRowFinishes(rows: readonly FinalStandingRow[], standings: readonly PodStandingRow[]) {
  const byPlayer = new Map(standings.map((row) => [row.playerId, row]));
  return rows.map((row) => {
    const standing = byPlayer.get(row.playerId);
    return {
      playerId: row.playerId,
      displayName: row.displayName,
      place: row.place,
      record: standing === undefined ? "" : formatPlayerRecord(standing, true),
    };
  });
}

function GroupCutStandingsView({
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
  metaShares?: { id: string; shares: LegendMetaShareView[] };
  live: boolean;
}) {
  const finalRows = groupStage.finalStandings;
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
              entries={bestFinishPerLegend(
                finalRowFinishes(finalRows, standings),
                legendCardByPlayer,
              )}
              cutSize={cutSize}
            />
          ) : null}
          <FinalStandingsCard
            rows={finalRows}
            cutSize={cutSize}
            rounds={rounds}
            legendByPlayer={legendsByPlayer(groupStage)}
            standings={standings}
          />
        </>
      )}
      <GroupCutStandings
        groupStage={groupStage}
        standings={standings}
        cutSize={cutSize}
        legendTiebreak={legendTiebreak}
        metaShares={live ? metaShares : undefined}
      />
    </>
  );
}

export function StandingsBody({
  format,
  cutSize,
  legendTiebreak,
  pairingStyle,
  playMode,
  regionsEnabled,
  standings,
  rounds,
  groupStage,
  legendCardByPlayer,
  live,
  completed,
  metaShares,
}: {
  format: PodReportResponse["format"];
  cutSize: CutSize;
  legendTiebreak: boolean;
  pairingStyle: PodReportResponse["pairingStyle"];
  playMode: PodReportResponse["playMode"];
  regionsEnabled: boolean;
  standings: PodStandingRow[];
  rounds: PodRoundResponse[];
  groupStage: GroupStageView | null;
  legendCardByPlayer: ReadonlyMap<string, string | null>;
  live: boolean;
  completed: boolean;
  metaShares?: { id: string; shares: LegendMetaShareView[] };
}) {
  if (isGroupCutStandings(format, groupStage)) {
    return (
      <GroupCutStandingsView
        cutSize={cutSize}
        legendTiebreak={legendTiebreak}
        groupStage={groupStage}
        rounds={rounds}
        standings={standings}
        legendCardByPlayer={legendCardByPlayer}
        metaShares={metaShares}
        live={live}
      />
    );
  }
  const variant = standingsVariant(pairingStyle);
  return (
    <>
      <StandingsPodium standings={standings} variant={variant} playMode={playMode} />
      {completed && live ? (
        <TournamentLegendFinishes
          entries={bestFinishPerLegend(
            rankedStandings(standings).map(({ row, rank }) => ({
              playerId: row.playerId,
              displayName: row.displayName,
              place: rank,
              record: formatPlayerRecord(row, variant === "swiss"),
            })),
            legendCardByPlayer,
          )}
        />
      ) : null}
      <StandingsTable
        standings={standings}
        variant={variant}
        playMode={playMode}
        regionsEnabled={regionsEnabled}
        rounds={rounds}
        legendByPlayer={legendCardByPlayer}
      />
      {regionsEnabled ? <RegionOverview standings={standings} /> : null}
    </>
  );
}
