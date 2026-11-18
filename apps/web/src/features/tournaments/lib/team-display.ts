// A team has no stored name: the pair of member display names is the
// identity. Every surface groups per-player rows into team rows through
// these helpers so the grouping rules can't drift apart.

import type { PodMemberResponse, PodStandingRow } from "@openrift/shared/types/api/pod-tournament";
import type { TournamentParticipantResponse } from "@openrift/shared/types/api/tournament";

import { participantName } from "@/features/tournaments/lib/participant-name";

export function teamDisplayName(memberNames: readonly string[]): string {
  return memberNames.join(" & ");
}

export function groupPodMembersByTeam(members: PodMemberResponse[]): PodMemberResponse[][] {
  const groups = Map.groupBy(members.entries(), ([index, member]) => member.teamId ?? index);
  return [...groups.values()].map((group) => group.map(([, member]) => member));
}

export function teamNamesById(
  rows: readonly { teamId: string | null; displayName: string | null }[],
): Map<string, string> {
  return new Map(
    [...participantsByTeam(rows)].map(([teamId, members]) => [
      teamId,
      teamDisplayName(members.map((member) => participantName(member.displayName))),
    ]),
  );
}

/**
 * Fixed teams share every stat by construction, so the first row of each team
 * stands for the pair; only the display name changes.
 */
export function collapseTeamStandings(standings: readonly PodStandingRow[]): PodStandingRow[] {
  const names = teamNamesById(standings);
  const seenTeams = new Set<string>();
  const rows: PodStandingRow[] = [];
  for (const row of standings) {
    if (row.teamId === null) {
      rows.push(row);
      continue;
    }
    if (seenTeams.has(row.teamId)) {
      continue;
    }
    seenTeams.add(row.teamId);
    rows.push({
      ...row,
      displayName: names.get(row.teamId) ?? row.displayName,
      image: null,
      gravatarHash: null,
    });
  }
  return rows;
}

export function participantsByTeam<T extends { teamId: string | null }>(
  participants: readonly T[],
): Map<string, T[]> {
  return Map.groupBy(
    participants.filter(
      (participant): participant is T & { teamId: string } => participant.teamId !== null,
    ),
    (participant) => participant.teamId,
  );
}

export function unteamedActivePlayers<
  T extends Pick<TournamentParticipantResponse, "status" | "teamId">,
>(participants: readonly T[]): T[] {
  return participants.filter(
    (participant) => participant.status === "active" && participant.teamId === null,
  );
}

export function teammateNamesById(
  participants: readonly Pick<TournamentParticipantResponse, "id" | "teamId" | "displayName">[],
): Map<string, string> {
  const names = new Map<string, string>();
  for (const members of participantsByTeam(participants).values()) {
    for (const member of members) {
      const teammate = members.find((other) => other.id !== member.id);
      if (teammate) {
        names.set(member.id, participantName(teammate.displayName));
      }
    }
  }
  return names;
}
