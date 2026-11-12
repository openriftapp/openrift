import type { Logger } from "@openrift/shared/logger";

import type { MetaSyncResultBase } from "./result.js";

interface JobRunsAccess {
  getResult: (id: string) => Promise<unknown>;
  mergeResult: (id: string, patch: object) => Promise<void>;
}

interface RunHeartbeatDeps {
  repos: { jobRuns: JobRunsAccess };
  log: Logger;
  now?: () => Date;
}

export interface RunHeartbeat {
  beat: (result: object) => Promise<boolean>;
  checkpoint: (result: MetaSyncResultBase) => Promise<boolean>;
  cancelled: () => Promise<boolean>;
}

const IDLE: RunHeartbeat = {
  beat: () => Promise.resolve(false),
  checkpoint: () => Promise.resolve(false),
  cancelled: () => Promise.resolve(false),
};

export function createRunHeartbeat(deps: RunHeartbeatDeps, runId?: string): RunHeartbeat {
  if (runId === undefined) {
    return IDLE;
  }
  const jobRuns = deps.repos.jobRuns;

  async function cancelled(): Promise<boolean> {
    try {
      const stored = await jobRuns.getResult(runId as string);
      return (
        typeof stored === "object" &&
        stored !== null &&
        (stored as { cancelRequested?: unknown }).cancelRequested === true
      );
    } catch (error) {
      deps.log.warn({ err: error, runId }, "Run cancel check failed");
      return false;
    }
  }

  // Must merge, not replace: a cancel written while this beat was assembling has to survive.
  async function beat(result: object): Promise<boolean> {
    const cancel = await cancelled();
    try {
      const now = deps.now?.() ?? new Date();
      await jobRuns.mergeResult(runId as string, { ...result, heartbeatAt: now.toISOString() });
    } catch (error) {
      deps.log.warn({ err: error, runId }, "Run heartbeat write failed");
    }
    return cancel;
  }

  return {
    beat,
    checkpoint: (result) => beat({ ...result, complete: false }),
    cancelled,
  };
}
