import { runReportedMutation } from "@/lib/run-reported-mutation";

/** Runs workspace writes one at a time, in the order they were asked for. */
export interface WorkspaceWriteQueue {
  idle: () => boolean;
  /** True while a write for this record runs or waits. */
  holds: (record: symbol | null) => boolean;
  /** Resolves `false` when the task threw; the error is already reported. */
  enqueue: (record: symbol | null, task: () => unknown) => Promise<boolean>;
}

export function createWorkspaceWriteQueue(): WorkspaceWriteQueue {
  let tail: Promise<unknown> = Promise.resolve();
  const waiting: (symbol | null)[] = [];
  return {
    idle: () => waiting.length === 0,
    holds: (record) => waiting.includes(record),
    enqueue: (record, task) => {
      waiting.push(record);
      const ahead = tail;
      const run = (async () => {
        await ahead;
        const ok = await runReportedMutation(async () => {
          await task();
        });
        waiting.splice(waiting.indexOf(record), 1);
        return ok;
      })();
      tail = run;
      return run;
    },
  };
}
