import { describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { jobSchedulesRepo } from "./job-schedules.js";

describe("jobSchedulesRepo", () => {
  it("get returns null for a kind with no schedule", async () => {
    const repo = jobSchedulesRepo(createMockDb([]));
    expect(await repo.get("tcgplayer.refresh")).toBeNull();
  });
});
