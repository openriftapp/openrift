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

  it("pulls rechecks forward only for events whose truncated start has passed", async () => {
    const recording = createRecordingDb([{ numAffectedRows: 1n }]);

    await uvsgamesEventsRepo(recording.db).pullForwardRechecks(["u1"], new Date());

    expect(recording.queries[0]).toContain("date_trunc('milliseconds', e.start_at) <= $");
  });

  it("counts a template's ran events up to the start of the UTC day", async () => {
    const recording = createRecordingDb([[]]);

    await uvsgamesEventsRepo(recording.db).listTemplates();

    expect(recording.queries[0]).toContain(
      "e.start_at < (now() at time zone 'UTC')::date::timestamp at time zone 'UTC'",
    );
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
