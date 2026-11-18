import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { uvsgamesEventsRepo } from "./uvsgames-events.js";

const TRUNCATED_START = "date_trunc('milliseconds', c.start_at)";

describe("uvsgamesEventsRepo instant comparisons", () => {
  it("bounds the list by the bare start column so its index stays usable", async () => {
    const recording = createRecordingDb([[], [{ total: "0" }]]);
    const dateFrom = new Date("2026-03-01T00:00:00.000Z");
    const dateTo = new Date("2026-03-31T23:59:59.999Z");

    await uvsgamesEventsRepo(recording.db).list({ dateFrom, dateTo }, { limit: 10, offset: 0 });

    for (const statement of recording.queries) {
      expect(statement).toContain("c.start_at >= $");
      expect(statement).toContain("c.start_at <= $");
      expect(statement).not.toContain(TRUNCATED_START);
    }
  });

  it("bounds markMissing by the bare start column, through the last millisecond of `to`", async () => {
    const recording = createRecordingDb([{ numAffectedRows: 2n }]);
    const from = new Date("2026-11-06T12:00:00.030Z");
    const to = new Date("2026-11-13T12:00:00.030Z");

    const flagged = await uvsgamesEventsRepo(recording.db).markMissing({
      from,
      to,
      seenBefore: to,
      at: to,
    });

    expect(flagged).toBe(2);
    expect(recording.queries[0]).toContain(`"start_at" >= $`);
    expect(recording.queries[0]).toContain(`"start_at" < $`);
    expect(recording.queries[0]).not.toContain("date_trunc('milliseconds', start_at)");
    expect(recording.parameters[0]).toContainEqual(from);
    expect(recording.parameters[0]).toContainEqual(new Date("2026-11-13T12:00:00.031Z"));
  });
});
