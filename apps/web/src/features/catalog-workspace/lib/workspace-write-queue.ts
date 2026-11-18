import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { runReportedMutation } from "@/lib/run-reported-mutation";
import { PERSISTENT_ERROR_TOAST } from "@/lib/toast";

export const WRITE_TIMEOUT_MS = 30_000;
export const LONG_TIMEOUT_MS = 5 * 60_000;
export const RELOAD_TIMEOUT_MS = 30_000;

export const WRITE_TIMED_OUT_NOTICE =
  "The save got no answer in 30 seconds. Whether it landed is unknown, so the record was reloaded.";

export const LONG_TIMED_OUT_NOTICE =
  "The save got no answer in 5 minutes. Whether it landed is unknown, so the record was reloaded.";

export const UPLOAD_TIMED_OUT_NOTICE =
  "The upload got no answer in 5 minutes. Whether it landed is unknown, so the record was reloaded.";

/** `upload` and `long` get {@link LONG_TIMEOUT_MS}; `upload` also names the upload in its notice. */
export type WriteLimit = "write" | "long" | "upload";

const LIMITS: Record<WriteLimit, { ms: number; notice: string }> = {
  write: { ms: WRITE_TIMEOUT_MS, notice: WRITE_TIMED_OUT_NOTICE },
  long: { ms: LONG_TIMEOUT_MS, notice: LONG_TIMED_OUT_NOTICE },
  upload: { ms: LONG_TIMEOUT_MS, notice: UPLOAD_TIMED_OUT_NOTICE },
};

/** A queued write. Every request it sends passes `signal` on, so it aborts with its task. */
export type WorkspaceWriteTask = (signal: AbortSignal) => unknown;

export interface EnqueueOptions {
  queryClient: QueryClient;
  limit?: WriteLimit;
}

/** Runs workspace writes one at a time, in the order they were asked for. */
export interface WorkspaceWriteQueue {
  idle: () => boolean;
  /** True while a write for this record runs or waits. */
  holds: (record: symbol | null) => boolean;
  /** True when every write that runs or waits belongs to this record, or none does. */
  holdsOnly: (record: symbol | null) => boolean;
  /** True when the task that ran before the running one timed out. */
  previousTimedOut: () => boolean;
  /**
   * Resolves `false` when the task threw or got no answer within its limit; the error is already
   * reported. A task past its limit frees the queue, which reloads before the next task runs.
   */
  enqueue: (
    record: symbol | null,
    task: WorkspaceWriteTask,
    options: EnqueueOptions,
  ) => Promise<boolean>;
}

function abortOf(signal: AbortSignal): Promise<null> {
  // oxlint-disable-next-line promise/avoid-new -- settles on the signal's abort event
  return new Promise((resolve) => {
    signal.addEventListener("abort", () => resolve(null), { once: true });
  });
}

/** Resolves with the work's result, or `null` when `signal` aborts first. */
async function settledOrAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T | null> {
  return signal.aborted ? null : Promise.race([work, abortOf(signal)]);
}

/** `timeoutSignal` creates the signal that aborts after the given milliseconds. */
export function createWorkspaceWriteQueue(
  timeoutSignal: (ms: number) => AbortSignal = (ms) => AbortSignal.timeout(ms),
): WorkspaceWriteQueue {
  let tail: Promise<unknown> = Promise.resolve();
  const waiting: (symbol | null)[] = [];
  let lastTimedOut = false;
  let previousTimedOut = false;
  return {
    idle: () => waiting.length === 0,
    holds: (record) => waiting.includes(record),
    holdsOnly: (record) => waiting.every((held) => held === record),
    previousTimedOut: () => previousTimedOut,
    enqueue: (record, task, { queryClient, limit = "write" }) => {
      waiting.push(record);
      const ahead = tail;
      const run = (async () => {
        await ahead;
        previousTimedOut = lastTimedOut;
        const signal = timeoutSignal(LIMITS[limit].ms);
        const ok = await settledOrAborted(
          runReportedMutation(async () => {
            await task(signal);
          }),
          signal,
        );
        const timedOut = ok === null || signal.aborted;
        if (timedOut) {
          await settledOrAborted(queryClient.invalidateQueries(), timeoutSignal(RELOAD_TIMEOUT_MS));
          toast.error(LIMITS[limit].notice, PERSISTENT_ERROR_TOAST);
        }
        lastTimedOut = timedOut;
        waiting.splice(waiting.indexOf(record), 1);
        return ok === true && !timedOut;
      })();
      tail = run;
      return run;
    },
  };
}

let shared = createWorkspaceWriteQueue();

/** The queue every workspace write and undo runs in, whether a key or a button started it. */
export function workspaceWriteQueue(): WorkspaceWriteQueue {
  return shared;
}

export function resetWorkspaceWriteQueue(): void {
  shared = createWorkspaceWriteQueue();
}
