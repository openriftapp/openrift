import { describe, expect, it } from "vitest";

import type { JobRun } from "../repositories/job-runs.js";
import { toJobRunView } from "./job-run-presenters.js";

const base: JobRun = {
  id: "run-1",
  kind: "tcgplayer.refresh",
  trigger: "cron",
  status: "succeeded",
  startedAt: new Date("2026-10-01T08:00:00.000Z"),
  finishedAt: new Date("2026-10-01T08:00:05.000Z"),
  durationMs: 5000,
  errorMessage: null,
  result: { updated: 3 },
  noop: false,
};

describe("toJobRunView", () => {
  it("serializes timestamps and passes an object result through", () => {
    expect(toJobRunView(base)).toEqual({
      ...base,
      startedAt: "2026-10-01T08:00:00.000Z",
      finishedAt: "2026-10-01T08:00:05.000Z",
    });
  });

  it("keeps a running job's finishedAt null", () => {
    expect(toJobRunView({ ...base, finishedAt: null }).finishedAt).toBeNull();
  });

  it("drops a non-object result to null", () => {
    expect(toJobRunView({ ...base, result: "done" }).result).toBeNull();
    expect(toJobRunView({ ...base, result: null }).result).toBeNull();
  });
});
