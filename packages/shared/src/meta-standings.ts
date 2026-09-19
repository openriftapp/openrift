/**
 * `roundType` is source vocabulary kept raw (`SWISS`,
 * `RANKED_SINGLE_ELIMINATION`); matched by substring, not a fixed list.
 */
export function isSingleElimination(roundType: string): boolean {
  return roundType.toUpperCase().includes("SINGLE_ELIMINATION");
}

export interface CutPhase {
  phaseOrder: number;
  roundType: string;
  roundCount: number | null;
  rankRequired: number | null;
}

export function cutPhaseOrders(phases: readonly CutPhase[]): Set<number> {
  return new Set(
    phases.filter((phase) => isSingleElimination(phase.roundType)).map((phase) => phase.phaseOrder),
  );
}

/** The largest elimination phase wins, so a third-place playoff filed as its own phase never shrinks the cut. */
export function cutSizeOf(phases: readonly CutPhase[]): number | null {
  let largest: number | null = null;
  for (const phase of phases) {
    if (!isSingleElimination(phase.roundType)) {
      continue;
    }
    const size = phase.rankRequired ?? (phase.roundCount === null ? null : 2 ** phase.roundCount);
    if (size !== null && (largest === null || size > largest)) {
      largest = size;
    }
  }
  return largest;
}

function formatOrdinal(value: number): string {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 13) {
    return `${value}th`;
  }
  const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  return `${value}${suffixes[value % 10] ?? "th"}`;
}

// rankIsTier means the source only publishes cut buckets, not exact standings: 1 and 2 still print as podium, 3+ print as "T4", "T8".
export function formatRank(rank: number, rankIsTier: boolean): string {
  if (!rankIsTier) {
    return formatOrdinal(rank);
  }
  const podium: Record<number, string> = { 1: "1st", 2: "2nd" };
  return podium[rank] ?? `T${rank}`;
}

// Missing draws print as 0, not omitted: a column mixing "5-1" and "5-1-0" would read as two kinds of number.
export function formatRecord(
  wins: number | null,
  losses: number | null,
  draws: number | null,
): string | null {
  if (wins === null || losses === null) {
    return null;
  }
  return `${wins}-${losses}-${draws ?? 0}`;
}
