import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { topdeckEventsRepo } from "./topdeck-events.js";

describe("topdeckEventsRepo markMissing", () => {
  it("bounds the window by the bare start column, through the last millisecond of `to`", async () => {
    const recording = createRecordingDb([{ numAffectedRows: 1n }]);
    const from = new Date("2026-10-13T07:30:00.036Z");
    const to = new Date("2026-11-12T07:30:00.036Z");

    const flagged = await topdeckEventsRepo(recording.db).markMissing({
      from,
      to,
      format: "Sealed",
      seenBefore: to,
      at: to,
    });

    expect(flagged).toBe(1);
    expect(recording.queries[0]).toContain(`"start_at" >= $`);
    expect(recording.queries[0]).toContain(`"start_at" < $`);
    expect(recording.queries[0]).not.toContain("date_trunc('milliseconds', start_at)");
    expect(recording.parameters[0]).toContainEqual(from);
    expect(recording.parameters[0]).toContainEqual(new Date("2026-11-12T07:30:00.037Z"));
  });
});
