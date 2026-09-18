import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { ShieldCheckIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { ArchiveListsBand } from "@/features/tournaments/components/archive-lists-band";
import { TournamentDeckCheckEntries } from "@/features/tournaments/components/deck-check-event-page";
import { DeckCheckIngestGuide } from "@/features/tournaments/components/deck-check-ingest-guide";
import {
  canCheckDecks,
  canManageTournament,
  effectiveTournamentState,
} from "@/features/tournaments/lib/tournament-display";
import { useFeatureEnabled } from "@/hooks/use-feature-flags";
import { m } from "@/paraglide/messages.js";

/** The entrant list comes from a staff-only endpoint; gate on host/organizer/judge here. */
export function TournamentDeckCheckTab({ detail }: { detail: TournamentDetailResponse }) {
  const canManage = canManageTournament(detail.myRoles);
  const metaEnabled = useFeatureEnabled("meta");
  if (!canCheckDecks(detail.myRoles)) {
    return (
      <EmptyState
        icon={ShieldCheckIcon}
        title={m.tournaments_deck_check_gate_title()}
        description={m.tournaments_deck_check_gate_description()}
      />
    );
  }
  const ended =
    effectiveTournamentState(detail.startsAt, detail.endsAt, detail.status) === "completed";
  return (
    <div className="flex flex-col gap-6">
      {metaEnabled && canManage && ended && detail.deckSubmission !== "none" ? (
        <ArchiveListsBand detail={detail} />
      ) : null}
      {canManage && detail.deckSubmission !== "none" ? (
        <DeckCheckIngestGuide tournamentId={detail.id} host={detail.host} />
      ) : null}
      <TournamentDeckCheckEntries tournamentId={detail.id} canManage={canManage} />
    </div>
  );
}
