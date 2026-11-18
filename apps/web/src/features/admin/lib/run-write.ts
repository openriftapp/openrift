import { runReportedMutation } from "@/lib/run-reported-mutation";

/**
 * Runs one write and resolves `true` when it landed. The catalog workspace queues the write
 * and hands it the task's abort signal; the write forwards it into its mutation call.
 */
export type RunWrite = (
  write: (signal?: AbortSignal) => Promise<unknown>,
  options?: { limit?: "write" | "long" | "upload" },
) => Promise<boolean>;

/** Runs the write at once, without a signal. */
export const runWriteDirectly: RunWrite = (write) => runReportedMutation(() => write());
