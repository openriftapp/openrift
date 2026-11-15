import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { playloltcgEventsRepo } from "./playloltcg-events.js";

describe("playloltcgEventsRepo buckets", () => {
  it("counts an event as started from its day in UTC", async () => {
    const recording = createRecordingDb([[], [{ total: "0" }]]);

    await playloltcgEventsRepo(recording.db).list(
      {
        bucket: {
          name: "skippedUpcoming",
          rule: { autoAcceptMinPlayers: 16, autoAcceptOfficial: false, autoAcceptNotable: false },
        },
      },
      { limit: 10, offset: 0 },
    );

    expect(recording.queries[0]).toContain("not (c.start_at <= (now() at time zone 'UTC')::date)");
  });

  it("reads an event without a status as holding no results, so it lands in one published bucket", async () => {
    const recording = createRecordingDb([[], [{ total: "0" }]]);

    await playloltcgEventsRepo(recording.db).list(
      {
        bucket: {
          name: "noResults",
          rule: { autoAcceptMinPlayers: 16, autoAcceptOfficial: false, autoAcceptNotable: false },
        },
      },
      { limit: 10, offset: 0 },
    );

    expect(recording.queries[0]).toContain("and not (coalesce(c.status = $");
  });

  it("counts a staged deck only when it holds card rows", async () => {
    const recording = createRecordingDb([[], [{ total: "0" }]]);

    await playloltcgEventsRepo(recording.db).list({}, { limit: 10, offset: 0 });

    expect(recording.queries[0]).toContain(
      "and exists (select 1 from playloltcg_decklist_cards dc where dc.source_deck_id = dl.source_deck_id)",
    );
  });
});
