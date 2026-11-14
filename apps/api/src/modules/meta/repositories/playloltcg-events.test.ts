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
});
