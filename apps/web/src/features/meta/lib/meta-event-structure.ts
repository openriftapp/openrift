import type { MetaEventMatch, MetaEventPhase } from "@openrift/shared/types/api/meta";

import { isSingleElimination } from "@/features/meta/lib/meta-bracket";
import { m } from "@/paraglide/messages.js";

export interface MetaEventStructure {
  swissRounds: number | null;
  cutSize: number | null;
  bestOf: number | null;
  sentence: string | null;
}

/** The largest elimination phase wins, so a third-place playoff filed as its own phase never shrinks the cut. */
function cutSizeOf(phases: readonly MetaEventPhase[]): number | null {
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

function swissRoundsOf(phases: readonly MetaEventPhase[]): number | null {
  let total = 0;
  for (const phase of phases) {
    if (!isSingleElimination(phase.roundType) && phase.roundCount !== null) {
      total += phase.roundCount;
    }
  }
  return total === 0 ? null : total;
}

function bestOfOf(phases: readonly MetaEventPhase[]): number | null {
  const wins = new Set<number>();
  for (const phase of phases) {
    if (phase.maxGameWins !== null && phase.maxGameWins > 0) {
      wins.add(phase.maxGameWins);
    }
  }
  const [maxGameWins] = wins;
  return wins.size === 1 && maxGameWins !== undefined ? maxGameWins * 2 - 1 : null;
}

function sentenceFor(
  swissRounds: number | null,
  cutSize: number | null,
  bestOf: number | null,
): string | null {
  const rounds =
    swissRounds === 1
      ? m.meta_structure_swiss_rounds_one()
      : m.meta_structure_swiss_rounds_other({ count: String(swissRounds) });
  const games = bestOf === null ? "" : m.meta_structure_best_of({ count: String(bestOf) });
  if (swissRounds !== null && cutSize !== null) {
    return m.meta_structure_swiss_then_cut({ rounds, games, cut: String(cutSize) });
  }
  if (swissRounds !== null) {
    return `${rounds}${games}`;
  }
  if (cutSize !== null) {
    return m.meta_structure_cut_only({ cut: String(cutSize), games });
  }
  return null;
}

export function describeEventStructure(phases: readonly MetaEventPhase[]): MetaEventStructure {
  const swissRounds = swissRoundsOf(phases);
  const cutSize = cutSizeOf(phases);
  const bestOf = bestOfOf(phases);
  return { swissRounds, cutSize, bestOf, sentence: sentenceFor(swissRounds, cutSize, bestOf) };
}

/** Null before the first round is in. */
export function describeEventProgress(
  matches: readonly MetaEventMatch[],
  phases: readonly MetaEventPhase[],
): string | null {
  if (matches.length === 0) {
    return null;
  }
  const phaseOrder = Math.max(...matches.map((match) => match.phaseOrder));
  const phase = phases.find((candidate) => candidate.phaseOrder === phaseOrder);
  if (phase !== undefined && isSingleElimination(phase.roundType)) {
    const cutSize = cutSizeOf(phases);
    return cutSize === null
      ? m.meta_progress_top_cut_under_way()
      : m.meta_progress_top_n_under_way({ cut: String(cutSize) });
  }
  const played = Math.max(
    ...matches.filter((match) => match.phaseOrder === phaseOrder).map((match) => match.roundNumber),
  );
  const total = phase?.roundCount ?? null;
  return total === null
    ? m.meta_progress_after_round({ played: String(played) })
    : m.meta_progress_after_round_of({ played: String(played), total: String(total) });
}
