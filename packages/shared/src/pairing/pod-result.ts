/** Null when the members don't form exactly two full teams (falls back to per-player scoring). */
export function teamsOf(members: readonly { teamId: string | null }[]): [string, string] | null {
  if (members.length !== 4 || members.some((member) => member.teamId === null)) {
    return null;
  }
  const [teamA, teamB, ...rest] = [...new Set(members.map((member) => member.teamId as string))];
  return teamA !== undefined && teamB !== undefined && rest.length === 0 ? [teamA, teamB] : null;
}

export function isResultlessPod(
  members: readonly { gamePoints: number | null }[],
  teams: [string, string] | null,
): boolean {
  return (
    teams === null && members.length > 2 && members.every((member) => member.gamePoints === null)
  );
}
