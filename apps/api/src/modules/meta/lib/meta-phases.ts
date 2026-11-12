interface PhaseShape {
  phaseOrder?: number;
  name?: string | null;
  roundType?: string | null;
  roundCount?: number | null;
  rankRequired?: number | null;
  maxGameWins?: number | null;
}

export function samePhases(stored: readonly PhaseShape[], next: readonly PhaseShape[]): boolean {
  if (stored.length !== next.length) {
    return false;
  }
  return next.every((row, index) => {
    const was = stored[index];
    return (
      was !== undefined &&
      was.phaseOrder === row.phaseOrder &&
      was.name === row.name &&
      was.roundType === row.roundType &&
      was.roundCount === row.roundCount &&
      was.rankRequired === row.rankRequired &&
      was.maxGameWins === row.maxGameWins
    );
  });
}
