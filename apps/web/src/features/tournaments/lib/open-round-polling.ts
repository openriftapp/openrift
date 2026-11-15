import { submissionWindowOpen } from "@openrift/shared/deck-check";

// While a round is open, results arrive from other people (players, the
// organizer); outside that, data only changes through this client's own mutations.
const OPEN_ROUND_REFETCH_MS = 5000;
const DECK_CHECK_REFETCH_MS = 5000;

export function openRoundRefetchInterval(
  data: { rounds: { status: string }[] } | undefined,
): number | false {
  return data?.rounds.some((round) => round.status === "reporting") ? OPEN_ROUND_REFETCH_MS : false;
}

interface DeckCheckPollData {
  event: { status: string; submissionsCloseAt: string | null };
  entries: { state: string; unlockRequestedAt: string | null }[];
}

export function deckCheckEntriesRefetchInterval(
  data: DeckCheckPollData | undefined,
  now = Date.now(),
): number | false {
  if (data === undefined) {
    return false;
  }
  const waitsOnJudge = data.entries.some(
    (entry) => entry.state === "submitted" || entry.unlockRequestedAt,
  );
  return waitsOnJudge || submissionWindowOpen(data.event, now) ? DECK_CHECK_REFETCH_MS : false;
}

export function deckCheckEntryRefetchInterval(
  data:
    | { event: DeckCheckPollData["event"]; entry: DeckCheckPollData["entries"][number] }
    | undefined,
  now = Date.now(),
): number | false {
  return deckCheckEntriesRefetchInterval(
    data === undefined ? undefined : { event: data.event, entries: [data.entry] },
    now,
  );
}

export function myDeckRefetchInterval(
  data: { entry: { state: string; windowOpen: boolean } } | undefined,
): number | false {
  if (!data?.entry.windowOpen) {
    return false;
  }
  return data.entry.state === "checked" || data.entry.state === "withdrawn"
    ? false
    : DECK_CHECK_REFETCH_MS;
}
