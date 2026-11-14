import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { uvsgamesResultsRepo } from "./uvsgames-results.js";

describe("uvsgamesResultsRepo.matches", () => {
  it("breaks ties within a table by the source match id", async () => {
    const recording = createRecordingDb([[]]);

    await uvsgamesResultsRepo(recording.db).matches("u1");

    expect(recording.queries[0]).toMatch(
      /order by "phase_order" asc, "round_number" asc, "table_number" asc, "source_match_id" asc$/u,
    );
  });
});
