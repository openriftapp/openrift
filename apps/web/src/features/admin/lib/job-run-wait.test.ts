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
    const getRun = vi.fn().mockResolvedValueOnce(run({})).mockResolvedValueOnce(finished);
    const wait = vi.fn(async () => {});

    await expect(waitForJobRun(getRun, wait)).resolves.toBe(finished);

    expect(getRun).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(2000);
  });

  it("gives up with an error once the run has stayed running for every poll", async () => {
    const getRun = vi.fn().mockResolvedValue(run({}));
    const wait = vi.fn(async () => {});

    await expect(waitForJobRun(getRun, wait, 3)).rejects.toThrow(/still going/u);
    expect(getRun).toHaveBeenCalledTimes(3);
  });

  it("resolves null when the run no longer exists", async () => {
    const getRun = vi.fn().mockResolvedValue(null);

    await expect(waitForJobRun(getRun, async () => {})).resolves.toBeNull();
  });
});

describe("waitForJobRun abort", () => {
  it("stops polling once the signal aborts", async () => {
    const controller = new AbortController();
    const getRun = vi.fn().mockResolvedValue(run({}));
    const wait = vi.fn(async () => {
      if (getRun.mock.calls.length === 2) {
        controller.abort();
      }
    });

    await expect(waitForJobRun(getRun, wait, 10, controller.signal)).resolves.toBe("aborted");
    expect(getRun).toHaveBeenCalledTimes(2);
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

  it("gives no counts for an aborted wait", () => {
    expect(checkMatchingResultFromRun("aborted")).toBeNull();
  });

  it("throws when the run disappeared", () => {
    expect(() => checkMatchingResultFromRun(null)).toThrow("disappeared");
  });
});
