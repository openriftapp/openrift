import type { DeckCheckEntryState } from "@openrift/shared/types/api/deck-check";
import type { ArchiveListEligibility } from "@openrift/shared/types/api/tournament";

interface EligibilityEntry {
  state: DeckCheckEntryState;
  allowDeckPublishing: boolean;
  allowNameSharing: boolean;
}

/**
 * The archive prints a list under the player's UVS Games name, so a list needs
 * both the publishing and the name consent. Neither can be overridden.
 */
export function archiveListEligibility(
  entry: EligibilityEntry | undefined,
): ArchiveListEligibility {
  if (entry === undefined) {
    return "no_list";
  }
  if (entry.state === "withdrawn") {
    return "withdrawn";
  }
  if (!entry.allowDeckPublishing) {
    return "no_consent";
  }
  if (!entry.allowNameSharing) {
    return "no_name_consent";
  }
  return entry.state === "approved" || entry.state === "checked" ? "ready" : "unchecked";
}

export function canSendArchiveList(eligibility: ArchiveListEligibility, force: boolean): boolean {
  return eligibility === "ready" || (eligibility === "unchecked" && force);
}

function foldName(name: string): string {
  return name.normalize("NFKC").toLowerCase().replaceAll(/\s+/gu, " ").trim();
}

/** Pairs a participant with a standings row only when the name is the same on both sides and unique on each. */
export function suggestArchiveListIdentities(
  participants: readonly { participantId: string; displayName: string }[],
  standings: readonly { identity: string; playerName: string | null }[],
): Map<string, string> {
  const byName = Map.groupBy(
    standings.filter((row) => row.playerName !== null),
    (row) => foldName(row.playerName ?? ""),
  );
  const participantsByName = Map.groupBy(participants, (participant) =>
    foldName(participant.displayName),
  );
  const suggestions = new Map<string, string>();
  for (const [name, group] of participantsByName) {
    const rows = byName.get(name);
    const [participant] = group;
    const [row] = rows ?? [];
    if (group.length === 1 && rows?.length === 1 && participant && row && name !== "") {
      suggestions.set(participant.participantId, row.identity);
    }
  }
  return suggestions;
}
