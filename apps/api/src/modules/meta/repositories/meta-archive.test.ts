import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { metaArchiveRepo } from "./meta-archive.js";

const UPCOMING = "(me.status = 'upcoming' or me.event_date > (now() at time zone 'UTC')::date)";

describe("metaArchiveRepo.latestResultDate", () => {
  it("leaves out an event that counts as upcoming, by status or by date", async () => {
    const recording = createRecordingDb([[{ latest: "2026-11-01" }]]);

    expect(await metaArchiveRepo(recording.db).latestResultDate()).toBe("2026-11-01");
    expect(recording.queries[0]).toContain(`not ${UPCOMING}`);
  });
});
