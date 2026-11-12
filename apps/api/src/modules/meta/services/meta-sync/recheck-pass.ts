import type { Logger } from "@openrift/shared/logger";
import { errorMessage } from "@openrift/shared/strings";

import { recordCapped } from "../../../../lib/json-coerce.js";
import type { RunHeartbeat } from "./run-heartbeat.js";
import { isGone, isPermanentRefusal } from "./source-http.js";
import type { SourceStop, SourceStopFields } from "./source-stop.js";
import { applySourceStop } from "./source-stop.js";

const MAX_FAILED_VISITS_IN_A_ROW = 5;

export type VisitOutcome = "ok" | "failed" | "answered";

export interface RecheckPassResult extends SourceStopFields {
  due: number;
  processed: number;
  dropped: number;
  requests: number;
  backedOff: boolean;
  cancelRequested: boolean;
  errors: string[];
}

export function emptyRecheckPassResult(): RecheckPassResult {
  return {
    due: 0,
    processed: 0,
    dropped: 0,
    requests: 0,
    backedOff: false,
    cancelRequested: false,
    blocked: false,
    blockedUntil: null,
    pausedUntil: null,
    errors: [],
  };
}

export interface RecheckPassSpec<Row, R extends RecheckPassResult> {
  result: R;
  heartbeat: RunHeartbeat;
  log: Logger;
  now: () => Date;
  /** ms */
  budgetMs: number;
  requests: () => number;
  maxRequests?: number;
  pageSize: number;
  prepare?: () => Promise<void>;
  due: (now: Date, limit: number) => Promise<readonly Row[]>;
  keyOf: (row: Row) => string | number;
  visit: (row: Row, now: Date, spent: number) => Promise<VisitOutcome>;
  grace: (row: Row, now: Date) => Promise<void>;
  drop: (row: Row) => Promise<void>;
  stopOf: (error: unknown) => SourceStop | null;
  deferOnStop?: (row: Row, stop: SourceStop, now: Date) => Promise<void>;
}

class PassStoppedError extends Error {
  readonly stop: SourceStop;
  readonly origin: unknown;

  constructor(stop: SourceStop, origin: unknown) {
    super(errorMessage(origin));
    this.name = "PassStoppedError";
    this.stop = stop;
    this.origin = origin;
  }
}

export async function runRecheckPass<Row, R extends RecheckPassResult>(
  spec: RecheckPassSpec<Row, R>,
): Promise<R> {
  const { result } = spec;
  const deadline = performance.now() + spec.budgetMs;
  const before = spec.requests();
  const spent = () => spec.requests() - before;
  const startedAt = spec.now();

  async function visitContained(row: Row): Promise<VisitOutcome> {
    const now = spec.now();
    try {
      return await spec.visit(row, now, spent());
    } catch (error) {
      const stop = spec.stopOf(error);
      if (stop !== null) {
        await spec.deferOnStop?.(row, stop, now);
        throw new PassStoppedError(stop, error);
      }
      recordCapped(result.errors, [`Event ${spec.keyOf(row)}: ${errorMessage(error)}`]);
      if (isGone(error)) {
        await spec.drop(row);
        result.dropped++;
        return "answered";
      }
      await spec.grace(row, now);
      if (isPermanentRefusal(error)) {
        return "answered";
      }
      spec.log.warn({ err: error, key: spec.keyOf(row) }, "Recheck visit failed");
      return "failed";
    }
  }

  const visited = new Set<string | number>();
  let failedInARow = 0;
  let stopped = false;
  try {
    await spec.prepare?.();
    while (
      !stopped &&
      performance.now() < deadline &&
      (spec.maxRequests === undefined || spent() < spec.maxRequests)
    ) {
      const due = await spec.due(spec.now(), spec.pageSize);
      const fresh = due.filter((row) => !visited.has(spec.keyOf(row)));
      if (fresh.length === 0) {
        break;
      }
      for (const row of fresh) {
        visited.add(spec.keyOf(row));
        result.due++;
        failedInARow = (await visitContained(row)) === "failed" ? failedInARow + 1 : 0;
        result.requests = spent();
        if (failedInARow >= MAX_FAILED_VISITS_IN_A_ROW) {
          result.backedOff = true;
          recordCapped(result.errors, [
            applySourceStop(result, "pause", spec.now(), `${failedInARow} visits in a row failed`),
          ]);
        }
        if (await spec.heartbeat.beat(result)) {
          result.cancelRequested = true;
          recordCapped(result.errors, ["Cancelled from the admin panel"]);
        }
        if (
          result.backedOff ||
          result.cancelRequested ||
          (spec.maxRequests !== undefined && spent() >= spec.maxRequests) ||
          performance.now() >= deadline
        ) {
          stopped = true;
          break;
        }
      }
    }
  } catch (error) {
    const stop = error instanceof PassStoppedError ? error.stop : spec.stopOf(error);
    const cause = error instanceof PassStoppedError ? error.origin : error;
    if (stop === null) {
      throw error;
    }
    spec.log.warn({ err: cause }, "The source stopped the recheck");
    recordCapped(result.errors, [applySourceStop(result, stop, startedAt, cause)]);
  }
  result.requests = spent();
  return result;
}
