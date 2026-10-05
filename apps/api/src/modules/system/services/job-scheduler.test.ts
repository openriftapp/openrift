import { createLogger } from "@openrift/shared/logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnyJobDefinition, JobScheduler } from "./job-scheduler.js";
import { createJobScheduler, defineJob } from "./job-scheduler.js";

const log = createLogger("test");

const jobSchedules = {
  listAll: vi.fn(),
  get: vi.fn(),
  upsert: vi.fn(),
  remove: vi.fn(),
};

const jobRuns = {
  getLatestPerKind: vi.fn(),
  getRunning: vi.fn(),
  start: vi.fn(),
  succeed: vi.fn(),
  fail: vi.fn(),
};

// Far enough out that no timer can fire during a test run.
const NEVER = "0 0 1 1 *";

function definition(overrides: Partial<AnyJobDefinition> = {}): AnyJobDefinition {
  return {
    kind: "tcgplayer.refresh",
    title: "TCGPlayer price refresh",
    description: "Fetches prices.",
    suggestedSchedule: NEVER,
    log,
    execute: vi.fn().mockResolvedValue({ updated: 1 }),
    ...overrides,
  };
}

function build(definitions: AnyJobDefinition[]): JobScheduler {
  return createJobScheduler({
    repos: { jobSchedules, jobRuns } as never,
    definitions,
    log,
  });
}

let scheduler: JobScheduler | null = null;

beforeEach(() => {
  vi.resetAllMocks();
  jobSchedules.listAll.mockResolvedValue([]);
  jobSchedules.get.mockResolvedValue(null);
  jobRuns.getLatestPerKind.mockResolvedValue({});
});

afterEach(() => {
  scheduler?.stop();
  scheduler = null;
});

describe("start", () => {
  it("registers a timer for every stored row with an available definition", async () => {
    jobSchedules.listAll.mockResolvedValue([
      { kind: "tcgplayer.refresh", schedule: NEVER, updatedAt: new Date() },
    ]);
    scheduler = build([definition()]);
    await scheduler.start();
    expect(scheduler.isEnabled("tcgplayer.refresh")).toBe(true);
  });

  it("leaves a job without a stored row off", async () => {
    scheduler = build([definition()]);
    await scheduler.start();
    expect(scheduler.isEnabled("tcgplayer.refresh")).toBe(false);
  });

  it("skips a row whose kind has no definition", async () => {
    jobSchedules.listAll.mockResolvedValue([
      { kind: "gone.away", schedule: NEVER, updatedAt: new Date() },
    ]);
    scheduler = build([definition()]);
    await expect(scheduler.start()).resolves.toBeUndefined();
    expect(scheduler.isEnabled("tcgplayer.refresh")).toBe(false);
  });

  it("skips a row for an unavailable job", async () => {
    jobSchedules.listAll.mockResolvedValue([
      { kind: "tcgplayer.refresh", schedule: NEVER, updatedAt: new Date() },
    ]);
    scheduler = build([definition({ unavailableReason: "TOKEN is not set." })]);
    await scheduler.start();
    expect(scheduler.isEnabled("tcgplayer.refresh")).toBe(false);
  });

  it("does not throw on a stored expression that no longer parses", async () => {
    jobSchedules.listAll.mockResolvedValue([
      { kind: "tcgplayer.refresh", schedule: "not a cron", updatedAt: new Date() },
    ]);
    scheduler = build([definition()]);
    await expect(scheduler.start()).resolves.toBeUndefined();
    expect(scheduler.isEnabled("tcgplayer.refresh")).toBe(false);
  });
});

describe("set", () => {
  it("stores the expression and arms the timer", async () => {
    scheduler = build([definition()]);
    const view = await scheduler.set("tcgplayer.refresh", NEVER);
    expect(jobSchedules.upsert).toHaveBeenCalledWith("tcgplayer.refresh", NEVER);
    expect(scheduler.isEnabled("tcgplayer.refresh")).toBe(true);
    expect(view.kind).toBe("tcgplayer.refresh");
    expect(view.available).toBe(true);
  });

  it("replaces the timer of a job that was already scheduled", async () => {
    scheduler = build([definition()]);
    await scheduler.set("tcgplayer.refresh", NEVER);
    await scheduler.set("tcgplayer.refresh", "0 0 2 1 *");
    expect(jobSchedules.upsert).toHaveBeenLastCalledWith("tcgplayer.refresh", "0 0 2 1 *");
    expect(scheduler.isEnabled("tcgplayer.refresh")).toBe(true);
  });

  it("rejects an invalid cron expression without writing a row", async () => {
    scheduler = build([definition()]);
    await expect(scheduler.set("tcgplayer.refresh", "every tuesday")).rejects.toThrow(
      /Invalid cron expression/u,
    );
    expect(jobSchedules.upsert).not.toHaveBeenCalled();
  });

  it("rejects an unavailable job with its reason", async () => {
    scheduler = build([definition({ unavailableReason: "TOKEN is not set." })]);
    await expect(scheduler.set("tcgplayer.refresh", NEVER)).rejects.toThrow("TOKEN is not set.");
    expect(jobSchedules.upsert).not.toHaveBeenCalled();
  });

  it("rejects a kind with no definition", async () => {
    scheduler = build([]);
    await expect(scheduler.set("tcgplayer.refresh", NEVER)).rejects.toThrow(/Unknown job/u);
  });
});

describe("disable", () => {
  it("removes the row and stops the timer", async () => {
    scheduler = build([definition()]);
    await scheduler.set("tcgplayer.refresh", NEVER);
    const view = await scheduler.disable("tcgplayer.refresh");
    expect(jobSchedules.remove).toHaveBeenCalledWith("tcgplayer.refresh");
    expect(scheduler.isEnabled("tcgplayer.refresh")).toBe(false);
    expect(view.schedule).toBeNull();
  });
});

describe("enableSuggested", () => {
  it("arms every available job that has no row yet", async () => {
    scheduler = build([
      definition(),
      definition({ kind: "cardmarket.refresh", suggestedSchedule: "0 0 3 1 *" }),
    ]);
    await scheduler.enableSuggested();
    expect(jobSchedules.upsert).toHaveBeenCalledWith("tcgplayer.refresh", NEVER);
    expect(jobSchedules.upsert).toHaveBeenCalledWith("cardmarket.refresh", "0 0 3 1 *");
  });

  it("leaves an unavailable job alone", async () => {
    scheduler = build([definition({ unavailableReason: "TOKEN is not set." })]);
    await scheduler.enableSuggested();
    expect(jobSchedules.upsert).not.toHaveBeenCalled();
  });

  it("does not overwrite a job that already has a row", async () => {
    jobSchedules.listAll.mockResolvedValue([
      { kind: "tcgplayer.refresh", schedule: "0 0 4 1 *", updatedAt: new Date() },
    ]);
    scheduler = build([definition()]);
    await scheduler.enableSuggested();
    expect(jobSchedules.upsert).not.toHaveBeenCalled();
  });
});

describe("runNow", () => {
  it("returns the new run's handle", async () => {
    jobRuns.getRunning.mockResolvedValue(null);
    jobRuns.start.mockResolvedValue({ id: "run-1" });
    scheduler = build([definition()]);
    await expect(scheduler.runNow("tcgplayer.refresh")).resolves.toEqual({
      runId: "run-1",
      status: "running",
    });
    expect(jobRuns.start).toHaveBeenCalledWith({ kind: "tcgplayer.refresh", trigger: "admin" });
  });

  it("reports the in-flight run instead of starting a second one", async () => {
    jobRuns.getRunning.mockResolvedValue({ id: "run-0" });
    scheduler = build([definition()]);
    await expect(scheduler.runNow("tcgplayer.refresh")).resolves.toEqual({
      runId: "run-0",
      status: "already_running",
    });
    expect(jobRuns.start).not.toHaveBeenCalled();
  });

  it("rejects an unavailable job", async () => {
    scheduler = build([definition({ unavailableReason: "TOKEN is not set." })]);
    await expect(scheduler.runNow("tcgplayer.refresh")).rejects.toThrow("TOKEN is not set.");
  });
});

describe("list", () => {
  it("returns one view per definition, in definition order", async () => {
    jobSchedules.listAll.mockResolvedValue([
      { kind: "cardmarket.refresh", schedule: NEVER, updatedAt: new Date("2026-08-01T00:00:00Z") },
    ]);
    jobRuns.getLatestPerKind.mockResolvedValue({
      "cardmarket.refresh": {
        startedAt: new Date("2026-08-02T00:00:00Z"),
        finishedAt: new Date("2026-08-02T00:00:05Z"),
        durationMs: 5000,
        status: "succeeded",
        errorMessage: null,
      },
    });
    scheduler = build([
      definition(),
      definition({ kind: "cardmarket.refresh", title: "Cardmarket price refresh" }),
    ]);
    await scheduler.start();

    const views = await scheduler.list();
    expect(views.map((view) => view.kind)).toEqual(["tcgplayer.refresh", "cardmarket.refresh"]);
    expect(views[0]!.schedule).toBeNull();
    expect(views[0]!.lastRun).toBeNull();
    expect(views[1]!.schedule).toBe(NEVER);
    expect(views[1]!.updatedAt).toBe("2026-08-01T00:00:00.000Z");
    expect(views[1]!.nextRun).not.toBeNull();
    expect(views[1]!.lastRun?.status).toBe("succeeded");
  });
});

describe("defineJob", () => {
  const meta = {
    kind: "tcgplayer.refresh",
    title: "TCGPlayer price refresh",
    description: "Fetches prices.",
    suggestedSchedule: NEVER,
  } as const;

  it("stores the result as returned when no summarize is given", () => {
    const job = defineJob(log, { ...meta, execute: async () => ({ updated: 1 }) });
    expect(job.summarize?.({ updated: 1 })).toEqual({ updated: 1 });
  });

  it("stores no result when summarize is false", () => {
    const job = defineJob(log, { ...meta, summarize: false, execute: async () => 1 });
    expect(job.summarize).toBeUndefined();
  });

  it("keeps an explicit summarize", () => {
    const job = defineJob(log, {
      ...meta,
      summarize: (result: { updated: number }) => result.updated,
      execute: async () => ({ updated: 3 }),
    });
    expect(job.summarize?.({ updated: 3 })).toBe(3);
  });

  it("hands execute and skipCronTick a logger named after the kind", async () => {
    const child = createLogger("child");
    const rootLog = { child: vi.fn(() => child) } as unknown as typeof log;
    const execute = vi.fn().mockResolvedValue(null);
    const skipCronTick = vi.fn().mockResolvedValue(null);
    const job = defineJob(rootLog, { ...meta, execute, skipCronTick });

    await job.execute("run-1");
    await job.skipCronTick?.();

    expect(rootLog.child).toHaveBeenCalledWith({ service: "tcgplayer.refresh" });
    expect(job.log).toBe(child);
    expect(execute).toHaveBeenCalledWith("run-1", child);
    expect(skipCronTick).toHaveBeenCalledWith(child);
  });
});
