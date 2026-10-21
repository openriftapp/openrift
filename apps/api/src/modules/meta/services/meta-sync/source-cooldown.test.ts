import { describe, expect, it } from "vitest";

import { cooldownUntil, jobPaused, sourceCoolingDown } from "./source-cooldown.js";

const NOW = new Date("2026-10-20T12:00:00Z");

function jobRuns(results: Record<string, unknown>) {
  return {
    getLatestForResume: (kind: string) =>
      Promise.resolve(kind in results ? { result: results[kind] } : null),
  };
}

describe("cooldownUntil", () => {
  it("lands six hours out", () => {
    expect(cooldownUntil(NOW)).toBe("2026-10-20T18:00:00.000Z");
  });
});

describe("jobPaused", () => {
  it("reads only the job's own pause, never another job's or a block", async () => {
    const runs = jobRuns({
      "meta.x_sync": { blockedUntil: "2026-10-20T13:00:00.000Z" },
      "meta.x_recheck": { pausedUntil: "2026-10-20T12:30:00.000Z" },
    });
    expect(await jobPaused(runs, "meta.x_recheck", NOW)).toBe(true);
    expect(await jobPaused(runs, "meta.x_sync", NOW)).toBe(false);
  });
});

describe("sourceCoolingDown", () => {
  it("holds while any of the kinds left a block in the future", async () => {
    const runs = jobRuns({
      "meta.x_sync": { blockedUntil: "2026-10-20T11:00:00.000Z" },
      "meta.x_backfill": { blockedUntil: "2026-10-20T13:00:00.000Z" },
    });
    expect(await sourceCoolingDown(runs, ["meta.x_sync", "meta.x_backfill"], NOW)).toBe(true);
  });

  it("ignores a job's own pause", async () => {
    const runs = jobRuns({ "meta.x_recheck": { pausedUntil: "2026-10-20T12:30:00.000Z" } });
    expect(await sourceCoolingDown(runs, ["meta.x_recheck"], NOW)).toBe(false);
  });

  it("lets a run through once every block has passed, or none was set", async () => {
    const runs = jobRuns({
      "meta.x_sync": { blockedUntil: "2026-10-20T11:00:00.000Z" },
      "meta.x_recheck": { blockedUntil: null },
    });
    expect(
      await sourceCoolingDown(runs, ["meta.x_sync", "meta.x_recheck", "meta.x_backfill"], NOW),
    ).toBe(false);
  });
});
