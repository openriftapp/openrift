// While a round is open, results arrive from other people (players, the
// organizer); outside that, data only changes through this client's own mutations.
const OPEN_ROUND_REFETCH_MS = 5000;
const DECK_CHECK_REFETCH_MS = 5000;

export function openRoundRefetchInterval(
  data: { rounds: { status: string }[] } | undefined,
): number | false {
  return data?.rounds.some((round) => round.status === "reporting") ? OPEN_ROUND_REFETCH_MS : false;
}

export function deckCheckEntriesRefetchInterval(
  data: { entries: { state: string; unlockRequestedAt: string | null }[] } | undefined,
): number | false {
  return data?.entries.some((entry) => entry.state === "submitted" || entry.unlockRequestedAt)
    ? DECK_CHECK_REFETCH_MS
    : false;
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
