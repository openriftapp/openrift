import type { DeckCheckEntryState } from "@openrift/shared/types/api/deck-check";
import type {
  ArchiveListParticipant,
  ArchiveListStateResponse,
  UvsgamesEventSuggestion,
} from "@openrift/shared/types/api/tournament";

import { isoOrNull } from "../../../lib/iso-date.js";
import { archiveListEligibility } from "./archive-lists.js";

export function toArchiveListEvent(event: {
  name: string;
  startAt: Date;
  displayStatus: string;
  playerCount: number | null;
  storeName: string | null;
  resultsFetchedAt: Date | null;
}): NonNullable<ArchiveListStateResponse["event"]> {
  return {
    name: event.name,
    startAt: event.startAt.toISOString(),
    displayStatus: event.displayStatus,
    playerCount: event.playerCount,
    storeName: event.storeName,
    resultsFetchedAt: isoOrNull(event.resultsFetchedAt),
  };
}

export function toArchiveListParticipant(
  participant: { id: string; displayName: string },
  entry:
    | {
        state: DeckCheckEntryState;
        allowDeckPublishing: boolean;
        allowNameSharing: boolean;
        unmatchedLineCount: number;
      }
    | undefined,
  suggestedIdentity: string | null,
): ArchiveListParticipant {
  return {
    participantId: participant.id,
    displayName: participant.displayName,
    entryState: entry?.state ?? null,
    eligibility: archiveListEligibility(entry),
    unmatchedLines: entry?.unmatchedLineCount ?? 0,
    suggestedIdentity,
  };
}

export function toUvsgamesEventSuggestion(row: {
  externalId: string;
  name: string;
  startAt: Date;
  storeName: string;
}): UvsgamesEventSuggestion {
  return {
    externalId: row.externalId,
    name: row.name,
    startAt: row.startAt.toISOString(),
    storeName: row.storeName,
  };
}
