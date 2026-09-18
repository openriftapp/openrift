import type {
  ArchiveListEligibility,
  ArchiveListParticipant,
} from "@openrift/shared/types/api/tournament";

export interface ArchiveListLink {
  participantId: string;
  identity: string;
  force: boolean;
}

/** A pick the organizer never touched falls back to the suggestion; `null` is an explicit "none". */
export function resolveArchiveListPick(
  pick: string | null | undefined,
  suggestion: string | null,
): string | null {
  return pick === undefined ? suggestion : pick;
}

export function canForceArchiveList(eligibility: ArchiveListEligibility): boolean {
  return eligibility === "unchecked";
}

export function isArchiveListSendable(
  eligibility: ArchiveListEligibility,
  forced: boolean,
): boolean {
  return eligibility === "ready" || (eligibility === "unchecked" && forced);
}

export interface ArchiveListPlan {
  links: ArchiveListLink[];
  duplicates: Set<string>;
  unmatched: number;
  leftOut: number;
}

export function planArchiveListSend(
  participants: readonly ArchiveListParticipant[],
  picks: Readonly<Record<string, string | null>>,
  forced: Readonly<Record<string, boolean>>,
): ArchiveListPlan {
  const links: ArchiveListLink[] = [];
  let unmatched = 0;
  let leftOut = 0;
  for (const participant of participants) {
    const force = forced[participant.participantId] === true;
    if (!isArchiveListSendable(participant.eligibility, force)) {
      leftOut++;
      continue;
    }
    const identity = resolveArchiveListPick(
      picks[participant.participantId],
      participant.suggestedIdentity,
    );
    if (identity === null) {
      unmatched++;
      continue;
    }
    links.push({ participantId: participant.participantId, identity, force });
  }
  const counts = Map.groupBy(links, (link) => link.identity);
  const duplicates = new Set(
    [...counts].filter(([, group]) => group.length > 1).map(([identity]) => identity),
  );
  return { links, duplicates, unmatched, leftOut };
}
