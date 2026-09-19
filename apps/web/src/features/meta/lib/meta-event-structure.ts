import { cutSizeOf, isSingleElimination } from "@openrift/shared/meta-standings";
import type { MetaEventField, MetaEventPhase } from "@openrift/shared/types/api/meta";

import { m } from "@/paraglide/messages.js";

export interface MetaEventStructure {
  swissRounds: number | null;
  cutSize: number | null;
  bestOf: number | null;
  sentence: string | null;
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
  const rounds = m.meta_structure_swiss_rounds({ count: swissRounds ?? 0 });
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
  progress: MetaEventField["progress"],
  phases: readonly MetaEventPhase[],
): string | null {
  if (progress === null) {
    return null;
  }
  const phase = phases.find((candidate) => candidate.phaseOrder === progress.phaseOrder);
  if (phase !== undefined && isSingleElimination(phase.roundType)) {
    const cutSize = cutSizeOf(phases);
    return cutSize === null
      ? m.meta_progress_top_cut_under_way()
      : m.meta_progress_top_n_under_way({ cut: String(cutSize) });
  }
  const total = phase?.roundCount ?? null;
  const played = String(progress.roundNumber);
  return total === null
    ? m.meta_progress_after_round({ played })
    : m.meta_progress_after_round_of({ played, total: String(total) });
}
