import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { metaEventIndexRepo } from "./meta-event-index.js";
import { PLAYED, RUNNING, UPCOMING } from "./meta-shared.js";

const sqlOf = (fragment: typeof UPCOMING) => fragment.compile(createRecordingDb().db).sql;
const UPCOMING_SQL = sqlOf(UPCOMING);
const PLAYED_SQL = sqlOf(PLAYED);

describe("metaEventIndexRepo", () => {
  it("filters the players range on the reported size, falling back to the standings held", async () => {
    const recording = createRecordingDb([[], [{ total: "0" }]]);

    await metaEventIndexRepo(recording.db).eventIndex(
      { playersMin: 16, playersMax: 64 },
      {},
      { limit: 25, offset: 0 },
    );

    const [statement] = recording.queries;
    expect(statement).toContain("(me.player_count >= $1 or me.id in (");
    expect(statement).toContain("having count(*) >= $2");
    expect(statement).toContain("(me.player_count <= $3 or me.id in (");
    expect(statement).toContain("having count(*) between 1 and $4");
    expect(statement).not.toContain("coalesce(me.player_count");
    expect(statement).not.toContain("p.meta_event_id = me.id");
    expect(recording.parameters[0]?.slice(0, 4)).toEqual([16, 16, 64, 64]);
  });

  it("sorts by players on the same field size", async () => {
    const recording = createRecordingDb([[], [{ total: "0" }]]);

    await metaEventIndexRepo(recording.db).eventIndex(
      {},
      { by: "players", dir: "desc" },
      { limit: 25, offset: 0 },
    );

    expect(recording.queries[0]).toContain(
      "coalesce(me.player_count, nullif(c.player_row_count, 0)) desc nulls last",
    );
  });

  it("keeps the default date order bare, so the event_date index serves it", async () => {
    const recording = createRecordingDb([[], [{ total: "0" }]]);

    await metaEventIndexRepo(recording.db).eventIndex({}, {}, { limit: 25, offset: 0 });

    expect(recording.queries[0]).toContain("order by me.event_date desc, case me.tier");
    expect(recording.queries[0]).not.toContain("nulls last");
  });

  it("reads upcoming outside the day-either-side window, and keeps running events out of the resultless set", async () => {
    const recording = createRecordingDb([
      [{ all: 0, decks: 0, standings: 0, upcoming: 0, resultless: 0 }],
    ]);

    await metaEventIndexRepo(recording.db).eventHoldingsCounts({});

    expect(recording.queries[0]).toContain(`count(*) filter (where ${UPCOMING_SQL})`);
    expect(recording.queries[0]).toContain(`and not ${UPCOMING_SQL} and ${PLAYED_SQL}`);
  });

  it("selects coming-up events in the query, so date order cannot starve them", async () => {
    const recording = createRecordingDb([[], [{ total: "0" }]]);

    await metaEventIndexRepo(recording.db).eventIndex(
      { holds: "comingUp", from: "2026-11-14" },
      { by: "date", dir: "asc" },
      { limit: 6, offset: 0 },
    );

    expect(recording.queries[0]).toContain(`(${UPCOMING_SQL} or ${sqlOf(RUNNING)})`);
    expect(recording.queries[0]).toContain("order by me.event_date asc");
  });
});
