import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { metaArchiveRepo } from "./meta-archive.js";
import { UPCOMING } from "./meta-shared.js";

const sqlOf = (fragment: typeof UPCOMING) => fragment.compile(createRecordingDb().db).sql;
const UPCOMING_SQL = sqlOf(UPCOMING);

describe("metaArchiveRepo.latestResultDate", () => {
  it("leaves out an event that counts as upcoming", async () => {
    const recording = createRecordingDb([[{ latest: "2026-11-01" }]]);

    expect(await metaArchiveRepo(recording.db).latestResultDate()).toBe("2026-11-01");
    expect(recording.queries[0]).toContain(`not ${UPCOMING_SQL}`);
  });
});
