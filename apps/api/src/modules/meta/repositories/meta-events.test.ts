import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { metaEventsRepo } from "./meta-events.js";
import { PLAYED, RUNNING, UPCOMING } from "./meta-shared.js";

const WINDOW = "at time zone 'UTC')::date - $1::int) at time zone 'UTC'";

function burstRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    slug: `event-${index}`,
    name: `Event ${index}`,
    created_at: new Date(Date.UTC(2026, 10, 10, 12, index)),
    event_slug: `event-${index}`,
    event_name: `Event ${index}`,
    count: "3",
    occurred_at: new Date(Date.UTC(2026, 10, 10, 12, index)),
  }));
}

describe("metaEventsRepo.recentActivity", () => {
  it("reads deck and standings bursts from the last week when that week holds enough", async () => {
    const recording = createRecordingDb();
    recording.setRows(burstRows(6));

    const rows = await metaEventsRepo(recording.db).recentActivity(6);

    expect(rows).toHaveLength(6);
    expect(recording.queries).toHaveLength(3);
    const bursts = recording.queries.filter((query) => query.includes("count(*)"));
    expect(bursts).toHaveLength(2);
    for (const query of bursts) {
      expect(query).toContain(WINDOW);
    }
  });

  it("falls back to the whole archive when the last week holds fewer bursts than asked for", async () => {
    const recording = createRecordingDb();
    recording.setRows(burstRows(2));

    await metaEventsRepo(recording.db).recentActivity(6);

    const bursts = recording.queries.filter((query) => query.includes("count(*)"));
    expect(bursts).toHaveLength(4);
    expect(bursts.filter((query) => query.includes(WINDOW))).toHaveLength(2);
    expect(bursts.filter((query) => !query.includes("now()"))).toHaveLength(2);
  });
});

describe("metaEventsRepo.listCounts", () => {
  it("counts a source-upcoming event within a day of its date as collecting", async () => {
    const recording = createRecordingDb([[{ total: "0" }]]);

    await metaEventsRepo(recording.db).listCounts({});

    const sqlOf = (fragment: typeof UPCOMING) => fragment.compile(recording.db).sql;
    const upcoming = sqlOf(UPCOMING);
    const played = sqlOf(PLAYED);
    const [statement] = recording.queries;
    expect(statement).toContain(`count(*) filter (where ${upcoming}) as "not_started"`);
    expect(statement).toContain(`count(*) filter (where ${sqlOf(RUNNING)}) as "collecting"`);
    expect(statement).toContain(
      `count(*) filter (where not ${upcoming} and ${played} and c.player_row_count = 0) as "no_results"`,
    );
  });
});
