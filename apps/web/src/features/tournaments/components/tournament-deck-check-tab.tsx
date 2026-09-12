import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { ShieldCheckIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { TournamentDeckCheckEntries } from "@/features/tournaments/components/deck-check-event-page";
import { DeckCheckIngestGuide } from "@/features/tournaments/components/deck-check-ingest-guide";
import { canCheckDecks, canManageTournament } from "@/features/tournaments/lib/tournament-display";
import { m } from "@/paraglide/messages.js";

/** The entrant list comes from a staff-only endpoint; gate on host/organizer/judge here. */
export function TournamentDeckCheckTab({ detail }: { detail: TournamentDetailResponse }) {
  const canManage = canManageTournament(detail.myRoles);
  if (!canCheckDecks(detail.myRoles)) {
    return (
      <EmptyState
        icon={ShieldCheckIcon}
        title={m.tournaments_deck_check_gate_title()}
        description={m.tournaments_deck_check_gate_description()}
      />
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {canManage && detail.deckSubmission !== "none" ? (
        <DeckCheckIngestGuide tournamentId={detail.id} host={detail.host} />
      ) : null}
      <TournamentDeckCheckEntries tournamentId={detail.id} canManage={canManage} />
    </div>
  );
}
