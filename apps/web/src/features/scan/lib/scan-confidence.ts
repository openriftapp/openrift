import { DEFAULT_ALIGNED_OPTIONS } from "@openrift/shared/scan/accept";

const SCORE_WEIGHT = 0.55;
const RUN_WEIGHT = 1 - SCORE_WEIGHT;

function unit(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export function ghostConfidence(
  bestScore: number,
  lockProgress: { runLength: number; lockRun: number },
): number {
  const scorePart = unit(bestScore / (DEFAULT_ALIGNED_OPTIONS.minScore * 100));
  const runPart =
    lockProgress.lockRun > 1 ? unit(lockProgress.runLength / lockProgress.lockRun) : 0;
  return unit(SCORE_WEIGHT * scorePart + RUN_WEIGHT * runPart);
}
