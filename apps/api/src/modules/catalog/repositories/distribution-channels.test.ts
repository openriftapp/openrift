import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { distributionChannelsRepo } from "./distribution-channels.js";

describe("distributionChannelsRepo.setForPrinting", () => {
  it("locks the printing row before it replaces the channels, in one transaction", async () => {
    const { db, statements, parameters, events } = createRecordingDb();

    await distributionChannelsRepo(db).setForPrinting("printing-1", [{ channelId: "channel-a" }]);

    expect(events).toEqual(["begin", "commit"]);
    expect(statements[0]?.sql).toMatch(/ for update$/u);
    expect(parameters).toEqual([["printing-1"], ["printing-1"], ["printing-1", "channel-a", null]]);
  });

  it("rolls back when the insert fails, keeping the old channels", async () => {
    const { db, events } = createRecordingDb([[], [], new Error("foreign key violation")]);

    await expect(
      distributionChannelsRepo(db).setForPrinting("printing-1", [{ channelId: "channel-a" }]),
    ).rejects.toThrow("foreign key violation");
    expect(events).toEqual(["begin", "rollback"]);
  });

  it("only clears the printing's channels when the new set is empty", async () => {
    const { db, parameters, events } = createRecordingDb();

    await distributionChannelsRepo(db).setForPrinting("printing-1", []);

    expect(parameters).toEqual([["printing-1"], ["printing-1"]]);
    expect(events).toEqual(["begin", "commit"]);
  });

  it("reuses an open transaction instead of nesting", async () => {
    const { db, events } = createRecordingDb();

    await db.transaction().execute(async (trx) => {
      await distributionChannelsRepo(trx).setForPrinting("printing-1", [
        { channelId: "channel-a", distributionNote: "Prerelease" },
      ]);
    });

    expect(events).toEqual(["begin", "commit"]);
  });
});
