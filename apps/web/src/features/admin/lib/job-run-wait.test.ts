import type { JobRunView } from "@openrift/shared/contracts/admin/job-runs";
import { describe, expect, it, vi } from "vitest";

import { checkMatchingResultFromRun, waitForJobRun } from "./job-run-wait";

function run(overrides: Partial<JobRunView>): JobRunView {
  return {
    id: "run-1",
    kind: "candidates.check_matching",
    trigger: "admin",
    status: "running",
    startedAt: "2026-09-15T06:56:17.000Z",
    finishedAt: null,
    durationMs: null,
    errorMessage: null,
    result: null,
    noop: null,
    ...overrides,
  };
}

describe("waitForJobRun", () => {
  it("keeps polling while the run is running and resolves with the finished run", async () => {
    const finished = run({ status: "succeeded", finishedAt: "2026-09-15T06:57:00.000Z" });
    const listRuns = vi
      .fn()
      .mockResolvedValueOnce([run({})])
      .mockResolvedValueOnce([run({ id: "other" }), finished]);
    const wait = vi.fn(async () => {});

    await expect(waitForJobRun("run-1", listRuns, wait)).resolves.toBe(finished);

    expect(listRuns).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(2000);
  });

  it("resolves null when the run is no longer listed", async () => {
    const listRuns = vi.fn().mockResolvedValue([run({ id: "other" })]);

    await expect(waitForJobRun("run-1", listRuns, async () => {})).resolves.toBeNull();
  });
});

describe("checkMatchingResultFromRun", () => {
  it("reads the counts from a succeeded run", () => {
    expect(
      checkMatchingResultFromRun(
        run({ status: "succeeded", result: { cardsChecked: 3, printingsChecked: 631 } }),
      ),
    ).toEqual({ cardsChecked: 3, printingsChecked: 631 });
  });

  it("throws the run's error message when it failed", () => {
    expect(() =>
      checkMatchingResultFromRun(run({ status: "failed", errorMessage: "connection reset" })),
    ).toThrow("connection reset");
  });

  it("throws when the run disappeared", () => {
    expect(() => checkMatchingResultFromRun(null)).toThrow("disappeared");
  });
});
