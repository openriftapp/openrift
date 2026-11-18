import { sleep } from "@openrift/shared/async";
import type { JobRunView } from "@openrift/shared/contracts/admin/job-runs";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 900;

/** The finished run, `null` when it is no longer listed, or "aborted" once the signal fired. */
export type JobRunWait = JobRunView | null | "aborted";

/** Polls until the run leaves `running`, for at most 30 minutes, and stops once `signal` aborts. */
export async function waitForJobRun(
  runId: string,
  listRuns: () => Promise<JobRunView[]>,
  wait: (ms: number) => Promise<void> = sleep,
  pollsLeft = MAX_POLLS,
  signal?: AbortSignal,
): Promise<JobRunWait> {
  if (pollsLeft <= 0) {
    throw new Error("The run is still going; check the job runs page for its result");
  }
  await wait(POLL_INTERVAL_MS);
  if (signal?.aborted === true) {
    return "aborted";
  }
  const runs = await listRuns();
  const run = runs.find((candidate) => candidate.id === runId);
  if (run === undefined) {
    return null;
  }
  if (run.status !== "running") {
    return run;
  }
  return waitForJobRun(runId, listRuns, wait, pollsLeft - 1, signal);
}

/** The run's counts, or `null` when the wait was aborted. */
export function checkMatchingResultFromRun(run: JobRunWait): {
  cardsChecked: number;
  printingsChecked: number;
} | null {
  if (run === "aborted") {
    return null;
  }
  if (run === null) {
    throw new Error("The check matching run disappeared before it finished");
  }
  if (run.status === "failed") {
    throw new Error(run.errorMessage ?? "Check matching failed");
  }
  return {
    cardsChecked: Number(run.result?.cardsChecked ?? 0),
    printingsChecked: Number(run.result?.printingsChecked ?? 0),
  };
}
