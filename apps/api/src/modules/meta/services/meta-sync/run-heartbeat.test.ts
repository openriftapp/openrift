import { isResumableCheckpoint } from "@openrift/shared/contracts/admin/meta-catalog";
import { createLogger } from "@openrift/shared/logger";
import { describe, expect, it, vi } from "vitest";

import { emptyMetaSyncResult } from "./result.js";
import { createRunHeartbeat } from "./run-heartbeat.js";

const NOW = new Date("2026-11-12T10:00:00.000Z");

function jobRuns(stored: unknown = {}) {
  return {
    getResult: vi.fn(() => Promise.resolve(stored)),
    mergeResult: vi.fn((_id: string, _patch: object) => Promise.resolve()),
  };
}

function heartbeatOver(runs: ReturnType<typeof jobRuns>, runId?: string) {
  return createRunHeartbeat(
    { repos: { jobRuns: runs }, log: createLogger("test"), now: () => NOW },
    runId,
  );
}

describe("createRunHeartbeat", () => {
  it("merges the result with the beat instant into the run's row", async () => {
    const runs = jobRuns();

    const cancelled = await heartbeatOver(runs, "run-1").beat({ processed: 3 });

    expect(cancelled).toBe(false);
    expect(runs.mergeResult).toHaveBeenCalledWith("run-1", {
      processed: 3,
      heartbeatAt: NOW.toISOString(),
    });
  });

  it("reports a cancel the admin wrote into the row", async () => {
    const runs = jobRuns({ cancelRequested: true });

    expect(await heartbeatOver(runs, "run-1").beat({})).toBe(true);
    expect(await heartbeatOver(runs, "run-1").cancelled()).toBe(true);
  });

  it("writes a checkpoint a later run can resume from, even from a finished-looking result", async () => {
    const runs = jobRuns();
    const result = { ...emptyMetaSyncResult(), coveredThrough: "2026-01-01T00:00:00.000Z" };

    await heartbeatOver(runs, "run-1").checkpoint(result);

    const written = runs.mergeResult.mock.calls[0]?.[1];
    expect(written).toMatchObject({ complete: false });
    expect(isResumableCheckpoint(written)).toBe(true);
    expect(result.complete).toBe(true);
  });

  it("logs and carries on when the row cannot be read or written", async () => {
    const runs = {
      getResult: vi.fn(() => Promise.reject(new Error("db gone"))),
      mergeResult: vi.fn(() => Promise.reject(new Error("db gone"))),
    };
    const heartbeat = heartbeatOver(runs, "run-1");

    await expect(heartbeat.beat({})).resolves.toBe(false);
    await expect(heartbeat.checkpoint(emptyMetaSyncResult())).resolves.toBe(false);
    await expect(heartbeat.cancelled()).resolves.toBe(false);
  });

  it("touches nothing without a run id", async () => {
    const runs = jobRuns({ cancelRequested: true });
    const heartbeat = heartbeatOver(runs);

    expect(await heartbeat.beat({})).toBe(false);
    expect(await heartbeat.cancelled()).toBe(false);
    expect(runs.getResult).not.toHaveBeenCalled();
    expect(runs.mergeResult).not.toHaveBeenCalled();
  });
});
