import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { markersRepo } from "./markers.js";

describe("markersRepo.setForPrinting", () => {
  it("surfaces a rejected marker unchanged", async () => {
    const { db } = createRecordingDb([new Error("unknown marker no-such")]);

    await expect(markersRepo(db).setForPrinting("printing-1", ["marker-a"])).rejects.toThrow(
      "unknown marker no-such",
    );
  });
});
