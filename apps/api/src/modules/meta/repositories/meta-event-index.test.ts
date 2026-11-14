import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { metaEventIndexRepo } from "./meta-event-index.js";

const UPCOMING = "(me.status = 'upcoming' or me.event_date > (now() at time zone 'UTC')::date)";

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

  it("reads upcoming from the status or the date, and keeps it out of the resultless set", async () => {
    const recording = createRecordingDb([
      [{ all: 0, decks: 0, standings: 0, upcoming: 0, resultless: 0 }],
    ]);

    await metaEventIndexRepo(recording.db).eventHoldingsCounts({});

    expect(recording.queries[0]).toContain(`count(*) filter (where ${UPCOMING})`);
    expect(recording.queries[0]).toContain(`and not ${UPCOMING} and me.status <> 'in_progress'`);
  });
});
