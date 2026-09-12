import { suggestedRoundCount } from "@openrift/shared/pairing/pod-sizes";
import type { PodTournamentDetailResponse } from "@openrift/shared/types/api/pod-tournament";
import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  useFinalizeTournamentRound,
  useRerollTournamentRound,
  useSubmitTournamentResult,
} from "@/features/tournaments/hooks/use-tournament-run";
import { m } from "@/paraglide/messages.js";

import { GenerateRoundControls } from "./generate-round-controls";
import { GroupCutPairingsSection } from "./group-cut-pairings-section";
import { PairingsView } from "./pairings-view";
import { PodPairingEditor } from "./pod-pairing-editor";
import { CompletedRoundsBand, OpenRoundBand } from "./round-state-band";

export function PodPairingsSection({
  id,
  data,
  staff = false,
  regionLabel,
}: {
  id: string;
  data: PodTournamentDetailResponse;
  staff?: boolean;
  regionLabel?: (slug: string) => string;
}) {
  const rerollRound = useRerollTournamentRound();
  const finalizeRound = useFinalizeTournamentRound();
  const submitResult = useSubmitTournamentResult();
  const [editingRound, setEditingRound] = useState<number | null>(null);
  const [warningsExpanded, setWarningsExpanded] = useState(true);

  const groupCut = data.tournament.format === "group_cut";
  const isSwiss = data.tournament.pairingStyle === "swiss";
  const teamMode = data.tournament.playMode === "2v2";
  const regionByPlayer = data.tournament.regionsEnabled
    ? new Map(data.standings.map((row) => [row.playerId, row.region]))
    : undefined;
  // Active players still missing a region: the server refuses to pair them, so
  // the generate controls block up front and point at the Participants page.
  const missingRegionIds = data.tournament.regionsEnabled
    ? data.standings
        .filter((row) => row.status === "active" && row.region === null)
        .map((row) => row.playerId)
    : [];
  const openRound = data.rounds.find((round) => round.status === "reporting");
  const completed = data.tournament.status === "completed";
  const finalizedCount = data.rounds.filter((round) => round.status === "finalized").length;
  const activePlayers = data.players.filter((player) => player.status === "active");
  const activeCount = activePlayers.length;
  // 2v2 paces by teams: the suggested round count and the odd-field auto-bye
  // hint both speak in pairing units, not people.
  const activeTeamCount = new Set(
    activePlayers.flatMap((player) => (player.teamId === null ? [] : [player.teamId])),
  ).size;
  const unitCount = teamMode ? activeTeamCount : activeCount;
  const suggested = suggestedRoundCount(unitCount);
  const reachedSuggestion = suggested > 0 && finalizedCount >= suggested;

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch {
      // Reported by the global mutation onError toast.
    }
  }

  // The manual editor takes over the open round; the rest of the history stays visible.
  const editing = editingRound !== null && openRound?.roundNumber === editingRound;
  const shownRounds = editing
    ? data.rounds.filter((round) => round.status === "finalized")
    : data.rounds;

  if (groupCut) {
    return <GroupCutPairingsSection id={id} data={data} staff={staff} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {completed ? (
        <CompletedRoundsBand finalizedCount={finalizedCount} />
      ) : openRound ? (
        <OpenRoundBand
          round={openRound}
          suggested={suggested}
          finalizing={finalizeRound.isPending}
          onFinalize={() =>
            void run(() => finalizeRound.mutateAsync({ id, roundNumber: openRound.roundNumber }))
          }
        />
      ) : (
        <GenerateRoundControls
          id={id}
          players={data.players}
          standings={data.standings}
          isFirstRound={data.rounds.length === 0}
          nextRoundNumber={data.rounds.length + 1}
          reachedSuggestion={reachedSuggestion}
          suggested={suggested}
          swissAutoBye={isSwiss && unitCount % 2 === 1}
          playMode={data.tournament.playMode}
          missingRegionIds={missingRegionIds}
        />
      )}
      {finalizedCount > 1 && !completed ? (
        <p className="text-muted-foreground text-sm">{m.tournaments_pairings_finalized_note()}</p>
      ) : null}
      {editing && openRound && data.openRoundSnapshot ? (
        <PodPairingEditor
          id={id}
          round={openRound}
          snapshot={data.openRoundSnapshot}
          mode={teamMode ? "team" : isSwiss ? "swiss" : "pod"}
          regionLabel={regionLabel}
          onClose={() => setEditingRound(null)}
        />
      ) : null}
      <PairingsView
        rounds={shownRounds}
        playMode={data.tournament.playMode}
        scheme={data.tournament.scoringScheme}
        byePoints={data.tournament.byePoints}
        matchFormat={data.tournament.matchFormat}
        winPoints={data.tournament.winPoints}
        drawPoints={data.tournament.drawPoints}
        regionByPlayer={regionByPlayer}
        regionLabel={regionLabel}
        showPenalty
        snapshot={data.openRoundSnapshot}
        warningsExpanded={warningsExpanded}
        canEnterResult={() => !completed}
        onSubmitResult={(podId, results) =>
          run(() => submitResult.mutateAsync({ id, podId, results }))
        }
        renderRoundActions={(round) => {
          if (round.status !== "reporting") {
            return null;
          }
          // Finalize lives in the round's state band above, not here.
          const anyReported = round.pods.some((pod) => pod.resultStatus === "reported");
          return (
            <>
              <Toggle
                size="sm"
                variant="outline"
                pressed={warningsExpanded}
                onPressedChange={setWarningsExpanded}
                aria-label={
                  warningsExpanded
                    ? m.tournaments_pairings_warnings_as_icons_aria()
                    : m.tournaments_pairings_warnings_in_full_aria()
                }
              >
                <TriangleAlertIcon />
                {warningsExpanded
                  ? m.tournaments_pairings_warnings_full()
                  : m.tournaments_pairings_warnings_icons()}
              </Toggle>
              <Button
                size="sm"
                variant="outline"
                disabled={anyReported}
                onClick={() => setEditingRound(round.roundNumber)}
              >
                {m.tournaments_pairings_edit_pairing()}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={anyReported || rerollRound.isPending}
                onClick={() =>
                  void run(() => rerollRound.mutateAsync({ id, roundNumber: round.roundNumber }))
                }
              >
                {m.tournaments_pairings_reroll()}
              </Button>
            </>
          );
        }}
        emptyMessage={editing ? "" : m.tournaments_pairings_no_rounds_yet()}
        emptyDescription={m.tournaments_pairings_no_rounds_description()}
      />
    </div>
  );
}
