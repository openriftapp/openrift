import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { playriftboundEventsRepo } from "./playriftbound-events.js";

describe("playriftboundEventsRepo markMissing", () => {
  it("bounds the window by the bare start column, through the last millisecond of `to`", async () => {
    const recording = createRecordingDb([{ numAffectedRows: 3n }]);
    const from = new Date("2026-11-06T08:00:00.045Z");
    const to = new Date("2026-11-27T08:00:00.045Z");

    const flagged = await playriftboundEventsRepo(recording.db).markMissing({
      from,
      to,
      seenBefore: from,
      at: from,
    });

    expect(flagged).toBe(3);
    expect(recording.queries[0]).toContain(`"start_at" >= $`);
    expect(recording.queries[0]).toContain(`"start_at" < $`);
    expect(recording.queries[0]).not.toContain("date_trunc('milliseconds', start_at)");
    expect(recording.parameters[0]).toContainEqual(from);
    expect(recording.parameters[0]).toContainEqual(new Date("2026-11-27T08:00:00.046Z"));
  });
});
