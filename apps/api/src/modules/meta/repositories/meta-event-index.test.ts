import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { metaEventIndexRepo } from "./meta-event-index.js";

describe("metaEventIndexRepo", () => {
  it("keeps the default date order bare, so the event_date index serves it", async () => {
    const recording = createRecordingDb([[], [{ total: "0" }]]);

    await metaEventIndexRepo(recording.db).eventIndex({}, {}, { limit: 25, offset: 0 });

    expect(recording.statements[0]?.sql).toMatch(/ order by me\.event_date desc, case me\.tier /u);
    expect(recording.statements[0]?.sql).not.toContain("nulls last");
  });
});
