import { MINUTE_MS } from "@openrift/shared/format-date";

import { recordCapped } from "../../../../lib/json-coerce.js";
import type { MetaSyncResultBase } from "./result.js";
import type { RunHeartbeat } from "./run-heartbeat.js";

// Must stay below STALE_RUN_MS (run-job.ts), or a second run is claimed while this one is alive.
export const DAILY_SYNC_TIME_BUDGET_MS = 90 * MINUTE_MS;

interface CrawlRunOptions<R extends MetaSyncResultBase> {
  result: R;
  heartbeat: RunHeartbeat;
  requests: () => number;
  maxRequests?: number;
  /** ms */
  maxDurationMs?: number;
  now?: () => number;
  beatEvery?: number;
}

export interface CrawlRun<R extends MetaSyncResultBase> {
  readonly result: R;
  readonly stopped: boolean;
  spent: () => number;
  record: (...messages: string[]) => void;
  stop: (message: string) => void;
  tick: () => Promise<boolean>;
  withinTime: () => boolean;
  outOfTime: () => boolean;
  checkpoint: () => Promise<boolean>;
  finish: () => R;
}

export function createCrawlRun<R extends MetaSyncResultBase>(
  options: CrawlRunOptions<R>,
): CrawlRun<R> {
  const { result, heartbeat, maxRequests, maxDurationMs } = options;
  const now = options.now ?? Date.now;
  const startedAt = now();
  const beatEvery = options.beatEvery ?? 1;
  const before = options.requests();
  let stopped = false;
  let ticks = 0;

  const spent = () => options.requests() - before;
  const record = (...messages: string[]) => recordCapped(result.errors, messages);
  const stop = (message: string) => {
    stopped = true;
    result.complete = false;
    record(message);
  };

  async function checkpoint(): Promise<boolean> {
    result.requests = spent();
    if (await heartbeat.checkpoint(result)) {
      result.cancelRequested = true;
      stop("Cancelled from the admin panel");
    }
    return !stopped;
  }

  const outOfTime = () => maxDurationMs !== undefined && now() - startedAt >= maxDurationMs;

  function withinTime(): boolean {
    if (stopped) {
      return false;
    }
    if (outOfTime()) {
      stop(`Stopped at the ${Math.round((maxDurationMs ?? 0) / MINUTE_MS)}-minute time budget`);
      return false;
    }
    return true;
  }

  async function tick(): Promise<boolean> {
    if (stopped) {
      return false;
    }
    if (maxRequests !== undefined && spent() >= maxRequests) {
      stop(`Stopped at the ${maxRequests}-request budget`);
      return false;
    }
    if (!withinTime()) {
      return false;
    }
    ticks++;
    return ticks % beatEvery === 0 ? await checkpoint() : true;
  }

  return {
    result,
    get stopped() {
      return stopped;
    },
    spent,
    record,
    stop,
    tick,
    withinTime,
    outOfTime,
    checkpoint,
    finish: () => {
      result.requests = spent();
      return result;
    },
  };
}
