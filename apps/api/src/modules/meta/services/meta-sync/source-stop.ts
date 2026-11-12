import { HOUR_MS } from "@openrift/shared/format-date";
import { errorMessage } from "@openrift/shared/strings";

import { sourceJobKinds } from "./job-kinds.js";

interface JobRunsRead {
  getLatestForResume: (kind: string) => Promise<{ result: unknown } | null>;
}

const BLOCK_MS = 6 * HOUR_MS;
const PAUSE_MS = 30 * 60 * 1000;

export type SourceStop = "block" | "pause";

export interface SourceStopFields {
  blocked: boolean;
  blockedUntil: string | null;
  pausedUntil: string | null;
}

export function cooldownUntil(now: Date): string {
  return new Date(now.getTime() + BLOCK_MS).toISOString();
}

export function pauseUntil(now: Date): string {
  return new Date(now.getTime() + PAUSE_MS).toISOString();
}

export function applySourceStop(
  result: SourceStopFields,
  stop: SourceStop,
  now: Date,
  cause?: unknown,
): string {
  const reason = cause === undefined ? "" : ` (${errorMessage(cause)})`;
  if (stop === "block") {
    result.blocked = true;
    result.blockedUntil = cooldownUntil(now);
    return `Stopped: the source refused further requests${reason}; every job of this source waits until ${result.blockedUntil}.`;
  }
  result.pausedUntil = pauseUntil(now);
  return `Stopped: the source throttled or kept failing${reason}; this job pauses until ${result.pausedUntil}.`;
}

function untilOf(prior: { result: unknown } | null, field: keyof SourceStopFields): number | null {
  const until = (prior?.result as Record<string, unknown> | null | undefined)?.[field];
  return typeof until === "string" ? new Date(until).getTime() : null;
}

export async function metaJobSkipReason(
  jobRuns: JobRunsRead,
  kind: string,
  now: Date,
): Promise<string | null> {
  const kinds = sourceJobKinds(kind);
  const priors = await Promise.all(kinds.map((each) => jobRuns.getLatestForResume(each)));
  const blockedBy = kinds.find(
    (_, index) => (untilOf(priors[index] ?? null, "blockedUntil") ?? 0) > now.getTime(),
  );
  if (blockedBy !== undefined) {
    return `${kind} skipped: ${blockedBy} hit a block and the source is cooling down`;
  }
  const own = priors[kinds.indexOf(kind)] ?? null;
  if ((untilOf(own, "pausedUntil") ?? 0) > now.getTime()) {
    return `${kind} skipped: paused after repeated failures or a throttle`;
  }
  return null;
}
