import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { customTagsRepo } from "./custom-tags.js";

describe("customTagsRepo.setForCard", () => {
  it("locks the card row before it replaces the tags, in one transaction", async () => {
    const { db, statements, parameters, events } = createRecordingDb();

    await customTagsRepo(db).setForCard("card-1", ["tag-a", "tag-b"]);

    expect(events).toEqual(["begin", "commit"]);
    expect(statements[0]?.sql).toMatch(/ for update$/u);
    expect(parameters).toEqual([["card-1"], ["card-1"], ["card-1", "tag-a", "card-1", "tag-b"]]);
  });

  it("rolls back when the insert fails, leaving the old tags in place", async () => {
    const { db, events } = createRecordingDb([[], [], new Error("unique violation")]);

    await expect(customTagsRepo(db).setForCard("card-1", ["tag-a"])).rejects.toThrow(
      "unique violation",
    );
    expect(events).toEqual(["begin", "rollback"]);
  });

  it("only clears the card's tags when the new set is empty", async () => {
    const { db, parameters, events } = createRecordingDb();

    await customTagsRepo(db).setForCard("card-1", []);

    expect(parameters).toEqual([["card-1"], ["card-1"]]);
    expect(events).toEqual(["begin", "commit"]);
  });

  it("reuses an open transaction instead of nesting, avoiding a savepoint-less second BEGIN", async () => {
    const { db, events } = createRecordingDb();

    await db.transaction().execute(async (trx) => {
      await customTagsRepo(trx).setForCard("card-1", ["tag-a"]);
    });

    expect(events).toEqual(["begin", "commit"]);
  });
});
