import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { moveRowsTo } from "./pair-merge.js";

describe("moveRowsTo", () => {
  it("leaves a list entry sum uncapped", async () => {
    const recording = createRecordingDb();
    await moveRowsTo(recording.db, "list_entries", "source-id", "home-id");

    const merge = recording.queries.find((query) =>
      query.trim().startsWith('UPDATE "list_entries" h SET'),
    );
    expect(merge).toContain('"quantity" = h."quantity" + s."quantity"');
  });
});
