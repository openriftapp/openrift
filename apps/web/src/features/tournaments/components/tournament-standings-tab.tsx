import type { PodTournamentDetailResponse } from "@openrift/shared/types/api/pod-tournament";
import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { useNavigate } from "@tanstack/react-router";

import { StandingsBody } from "@/features/tournaments/components/standings-body";
import {
  snapshotRound,
  StandingsRoundPicker,
} from "@/features/tournaments/components/standings-round-picker";
import {
  useStandingsSnapshot,
  useTournamentRunState,
} from "@/features/tournaments/hooks/use-tournament-run";
import { latestSnapshotRound } from "@/features/tournaments/lib/player-run";
import { isGroupCutStandings } from "@/features/tournaments/lib/standings-display";
import { canManageTournament } from "@/features/tournaments/lib/tournament-display";

type Tournament = PodTournamentDetailResponse["tournament"];

function SnapshotStandings({
  id,
  round,
  tournament,
  legendCardByPlayer,
}: {
  id: string;
  round: number;
  tournament: Tournament;
  legendCardByPlayer: ReadonlyMap<string, string | null>;
}) {
  const { data } = useStandingsSnapshot(id, round);
  return (
    <StandingsBody
      format={tournament.format}
      cutSize={tournament.cutSize}
      legendTiebreak={tournament.legendTiebreak}
      pairingStyle={tournament.pairingStyle}
      playMode={tournament.playMode}
      regionsEnabled={tournament.regionsEnabled}
      standings={data.standings}
      rounds={data.rounds}
      groupStage={data.groupStage}
      legendCardByPlayer={legendCardByPlayer}
      live={false}
      completed={tournament.status === "completed"}
    />
  );
}

export function TournamentStandingsTab({
  id,
  detail,
  round: requestedRound,
}: {
  id: string;
  detail: TournamentDetailResponse;
  round?: number;
}) {
  const { data } = useTournamentRunState(id);
  const navigate = useNavigate();
  const tournament = data.tournament;
  const legendCardByPlayer = new Map(
    data.players.map((player) => [player.id, player.legendCardId] as const),
  );
  const latestRound = latestSnapshotRound(
    data.rounds,
    isGroupCutStandings(tournament.format, data.groupStage),
  );
  const snapshot = snapshotRound(requestedRound, latestRound);
  const pickRound = (round: number | null) =>
    void navigate({
      to: "/tournaments/$id/standings",
      params: { id },
      search: round === null ? {} : { round },
    });

  return (
    <div className="flex flex-col gap-6">
      <StandingsRoundPicker latestRound={latestRound} selected={snapshot} onSelect={pickRound} />
      {snapshot === null ? (
        <StandingsBody
          format={tournament.format}
          cutSize={tournament.cutSize}
          legendTiebreak={tournament.legendTiebreak}
          pairingStyle={tournament.pairingStyle}
          playMode={tournament.playMode}
          regionsEnabled={tournament.regionsEnabled}
          standings={data.standings}
          rounds={data.rounds}
          groupStage={data.groupStage}
          legendCardByPlayer={legendCardByPlayer}
          live
          completed={tournament.status === "completed"}
          metaShares={
            canManageTournament(detail.myRoles) ? { id, shares: data.legendMetaShares } : undefined
          }
        />
      ) : (
        <SnapshotStandings
          id={id}
          round={snapshot}
          tournament={tournament}
          legendCardByPlayer={legendCardByPlayer}
        />
      )}
    </div>
  );
}
