import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { eventStatusForTournamentStatus } from "./deck-check-shared.js";
import { deckCheckRepo } from "./deck-check.js";

describe("eventStatusForTournamentStatus", () => {
  it("treats setup and running as active (submissions are handed in before start)", () => {
    expect(eventStatusForTournamentStatus("setup")).toBe("active");
    expect(eventStatusForTournamentStatus("running")).toBe("active");
  });

  it("archives only a completed or cancelled tournament", () => {
    expect(eventStatusForTournamentStatus("completed")).toBe("archived");
    expect(eventStatusForTournamentStatus("cancelled")).toBe("archived");
  });
});

describe("deckCheckRepo.deleteEntryCardCopy", () => {
  it("returns false when the line is already gone", async () => {
    const { db, queries } = createRecordingDb([[]]);

    const removed = await deckCheckRepo(db).deleteEntryCardCopy("entry-1", "card-1", 0);

    expect(removed).toBe(false);
    expect(queries).toHaveLength(1);
  });
});

describe("deckCheckRepo.updateEntry", () => {
  it("rolls back when the entry write fails after the participant write", async () => {
    const { db, events } = createRecordingDb([
      [{ participant_id: "participant-1" }],
      { numAffectedRows: 1n },
      new Error("deadlock detected"),
    ]);

    await expect(
      deckCheckRepo(db).updateEntry("entry-1", { playerName: "Ekko", state: "checked" }),
    ).rejects.toThrow("deadlock detected");
    expect(events).toEqual(["begin", "rollback"]);
  });

  it("reports a missing entry without opening a write", async () => {
    const { db, events, queries } = createRecordingDb([[]]);

    const updated = await deckCheckRepo(db).updateEntry("entry-1", { playerName: "Ekko" });

    expect(updated).toBeUndefined();
    expect(queries).toHaveLength(1);
    expect(events).toEqual(["begin", "commit"]);
  });

  it("skips the transaction entirely when the patch is empty", async () => {
    const { db, events } = createRecordingDb([[]]);

    await deckCheckRepo(db).updateEntry("entry-1", {});

    expect(events).toEqual([]);
  });
});
