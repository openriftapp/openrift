import { recordCapped } from "../../../../lib/json-coerce.js";
import type { MetaSyncResultBase } from "./result.js";
import type { RunHeartbeat } from "./run-heartbeat.js";

interface CrawlRunOptions<R extends MetaSyncResultBase> {
  result: R;
  heartbeat: RunHeartbeat;
  requests: () => number;
  maxRequests?: number;
  beatEvery?: number;
}

export interface CrawlRun<R extends MetaSyncResultBase> {
  readonly result: R;
  readonly stopped: boolean;
  spent: () => number;
  record: (...messages: string[]) => void;
  stop: (message: string) => void;
  tick: () => Promise<boolean>;
  checkpoint: () => Promise<boolean>;
  finish: () => R;
}

export function createCrawlRun<R extends MetaSyncResultBase>(
  options: CrawlRunOptions<R>,
): CrawlRun<R> {
  const { result, heartbeat, maxRequests } = options;
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

  async function tick(): Promise<boolean> {
    if (stopped) {
      return false;
    }
    if (maxRequests !== undefined && spent() >= maxRequests) {
      stop(`Stopped at the ${maxRequests}-request budget`);
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
    checkpoint,
    finish: () => {
      result.requests = spent();
      return result;
    },
  };
}
