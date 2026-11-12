import type { MetaSyncResultBase } from "./result.js";

interface StopFlags {
  blocked?: boolean;
  throttled?: boolean;
}

export function isSyncNoop(
  result: MetaSyncResultBase & StopFlags,
  sourceCounts: readonly number[] = [],
): boolean {
  return (
    result.complete &&
    !result.cancelRequested &&
    result.blocked !== true &&
    result.throttled !== true &&
    result.errors.length === 0 &&
    [
      result.inserted,
      result.changed,
      result.missing,
      result.autoAccepted,
      result.autoHeld,
      ...sourceCounts,
    ].every((count) => count === 0)
  );
}

interface RecheckPassCounts {
  processed: number;
  pulledForward: number;
  errors: readonly string[];
  blocked?: boolean;
  cancelRequested?: boolean;
}

export function isRecheckPassNoop(result: RecheckPassCounts): boolean {
  return (
    result.processed === 0 &&
    result.pulledForward === 0 &&
    result.errors.length === 0 &&
    result.blocked !== true &&
    result.cancelRequested !== true
  );
}
