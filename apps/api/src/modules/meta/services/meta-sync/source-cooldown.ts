interface JobRunsRead {
  getLatestForResume: (kind: string) => Promise<{ result: unknown } | null>;
}

const COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** When a run that hit a block may try again; written to the run's `blockedUntil`. */
export function cooldownUntil(now: Date): string {
  return new Date(now.getTime() + COOLDOWN_MS).toISOString();
}

async function anyUntil(
  jobRuns: JobRunsRead,
  kinds: readonly string[],
  field: "blockedUntil" | "pausedUntil",
  now: Date,
): Promise<boolean> {
  const priors = await Promise.all(kinds.map((kind) => jobRuns.getLatestForResume(kind)));
  return priors.some((prior) => {
    const result = prior?.result as Record<string, unknown> | null | undefined;
    const until = result?.[field];
    return typeof until === "string" && new Date(until).getTime() > now.getTime();
  });
}

/** True while the latest run of any of `kinds` left a `blockedUntil` still in the future. */
export function sourceCoolingDown(
  jobRuns: JobRunsRead,
  kinds: readonly string[],
  now: Date,
): Promise<boolean> {
  return anyUntil(jobRuns, kinds, "blockedUntil", now);
}

/** True while the latest run of `kind` itself left a `pausedUntil` still in the future. */
export function jobPaused(jobRuns: JobRunsRead, kind: string, now: Date): Promise<boolean> {
  return anyUntil(jobRuns, [kind], "pausedUntil", now);
}
