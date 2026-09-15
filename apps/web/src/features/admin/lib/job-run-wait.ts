import type { JobRunView } from "@openrift/shared/contracts/admin/job-runs";

const POLL_INTERVAL_MS = 2000;

function sleep(ms: number): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new -- wrapping the callback-based setTimeout
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Polls until the run leaves `running`; resolves `null` when the run is no longer listed. */
export async function waitForJobRun(
  runId: string,
  listRuns: () => Promise<JobRunView[]>,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<JobRunView | null> {
  await wait(POLL_INTERVAL_MS);
  const runs = await listRuns();
  const run = runs.find((candidate) => candidate.id === runId);
  if (run === undefined) {
    return null;
  }
  if (run.status !== "running") {
    return run;
  }
  return waitForJobRun(runId, listRuns, wait);
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
