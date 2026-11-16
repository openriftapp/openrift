import { sleep } from "@openrift/shared/async";
import type { JobRunView } from "@openrift/shared/contracts/admin/job-runs";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 900;

/** Polls until the run leaves `running`, for at most 30 minutes; resolves `null` when the run
 *  is no longer listed. */
export async function waitForJobRun(
  runId: string,
  listRuns: () => Promise<JobRunView[]>,
  wait: (ms: number) => Promise<void> = sleep,
  pollsLeft = MAX_POLLS,
): Promise<JobRunView | null> {
  if (pollsLeft <= 0) {
    throw new Error("The run is still going; check the job runs page for its result");
  }
  await wait(POLL_INTERVAL_MS);
  const runs = await listRuns();
  const run = runs.find((candidate) => candidate.id === runId);
  if (run === undefined) {
    return null;
  }
  if (run.status !== "running") {
    return run;
  }
  return waitForJobRun(runId, listRuns, wait, pollsLeft - 1);
}

export function checkMatchingResultFromRun(run: JobRunView | null): {
  cardsChecked: number;
  printingsChecked: number;
} {
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
