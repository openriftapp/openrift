import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { markersRepo } from "./markers.js";

describe("markersRepo.setForPrinting", () => {
  it("writes the markers onto the printing's first face in one statement", async () => {
    const { db, queries } = createRecordingDb();

    await markersRepo(db).setForPrinting("printing-1", ["marker-a", "marker-b"]);

    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('update "faces" set "marker_slugs"');
    expect(queries[0]).toContain('select "face1_id" from "printings"');
  });

  it("clears the face's markers when the new set is empty", async () => {
    const { db, queries } = createRecordingDb();

    await markersRepo(db).setForPrinting("printing-1", []);

    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain("'{}'::text[]");
  });

  it("surfaces a rejected marker unchanged", async () => {
    const { db } = createRecordingDb([new Error("unknown marker no-such")]);

    await expect(markersRepo(db).setForPrinting("printing-1", ["marker-a"])).rejects.toThrow(
      "unknown marker no-such",
    );
  });
});
