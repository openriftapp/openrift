import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { metaEventsRepo } from "./meta-events.js";

describe("metaEventsRepo.updateEvent", () => {
  it("locks the event row before it compares the facts a hold depends on", async () => {
    const recording = createRecordingDb([
      [{ name: "Summoner Skirmish", event_date: "2026-10-17", organizer: "Piltover Hobbies" }],
      { numAffectedRows: 1n },
      { numAffectedRows: 0n },
    ]);

    await metaEventsRepo(recording.db).updateEvent("live-1", { name: "Summoner Skirmish Finals" });

    expect(recording.events).toEqual(["begin", "commit"]);
    expect(recording.statements[0]?.sql).toMatch(/ for update$/u);
  });
});
