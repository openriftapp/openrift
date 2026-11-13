export interface SeatGroup {
  label: string;
  pairedGroupLabel: string | null;
  playerIds: string[];
}

export function swapSeats(groups: readonly SeatGroup[], a: string, b: string): SeatGroup[] {
  if (a === b) {
    return [...groups];
  }
  return groups.map((group) => ({
    ...group,
    playerIds: group.playerIds.map((playerId) =>
      playerId === a ? b : playerId === b ? a : playerId,
    ),
  }));
}
