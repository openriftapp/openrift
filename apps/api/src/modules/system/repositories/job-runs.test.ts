import { describe, expect, it } from "vitest";

import { createRecordingDb, onlyStatement } from "../../../test/recording-db.js";
import { jobRunsRepo } from "./job-runs.js";

describe("jobRunsRepo", () => {
  it("finishes a run only while it is still running", async () => {
    const recorded = createRecordingDb();
    const repo = jobRunsRepo(recorded.db);

    await repo.succeed("run-1", { durationMs: 5 });
    expect(onlyStatement(recorded).sql).toMatch(/where "id" = \$\d+ and "status" = \$\d+$/u);
    expect(recorded.parameters[0]).toContain("running");

    recorded.reset();
    await repo.fail("run-1", { durationMs: 5, errorMessage: "boom" });
    expect(onlyStatement(recorded).sql).toMatch(/where "id" = \$\d+ and "status" = \$\d+$/u);
    expect(recorded.parameters[0]).toContain("running");
  });

  it("judges a running run by its newest heartbeat", async () => {
    const recorded = createRecordingDb([[{ id: "run-1", last_seen_at: new Date(0) }]]);
    const repo = jobRunsRepo(recorded.db);

    await repo.getRunning("k");
    expect(onlyStatement(recorded).sql).toContain(
      "greatest(started_at, (result ->> 'heartbeatAt')::timestamptz)",
    );

    recorded.reset();
    await repo.failStale("run-1", new Date(), "stale");
    const { sql } = onlyStatement(recorded);
    expect(sql).toContain("greatest(started_at, (result ->> 'heartbeatAt')::timestamptz) <");
    expect(sql).not.toContain('"started_at" <');
  });
});
