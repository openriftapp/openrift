import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { metaOverlaysRepo } from "./meta-overlays.js";
import { metaSubmissionsRepo } from "./meta-submissions.js";

describe("admin edit lookups", () => {
  it("read the stored origin and nothing else", async () => {
    const { db, queries, parameters } = createRecordingDb();
    const repo = metaOverlaysRepo(db);

    await repo.adminEditOverlay("event-1", "admin-1");
    await repo.adminEditEventOverlayIds(["overlay-1"]);
    await repo.adminPlayerEditOverlay("player-1", "admin-1");
    await repo.adminEditPlayerOverlayIds(["overlay-2"]);

    expect(queries).toHaveLength(4);
    for (const [index, query] of queries.entries()) {
      expect(query).toContain('"origin" = $');
      expect(query).not.toContain("meta_submissions");
      expect(query).not.toContain("submission_note");
      expect(parameters[index]).toContain("admin_edit");
    }
  });
});

describe("event correction link", () => {
  it("finds a correction by the overlay it was applied as", async () => {
    const { db, queries, parameters } = createRecordingDb([[]]);

    await expect(
      metaSubmissionsRepo(db).acceptedCorrectionForOverlay({ id: "overlay-1" }),
    ).resolves.toBeNull();

    expect(queries[0]).toContain('"event_overlay_id" = $1');
    expect(queries[0]).not.toContain("resolved_at");
    expect(parameters[0]).toEqual(["overlay-1", "event_correction", "accepted"]);
  });

  it("stores the applied overlay with the acceptance", async () => {
    const { db, queries, parameters } = createRecordingDb();

    await metaSubmissionsRepo(db).recordAcceptance({
      submissionId: "submission-1",
      credit: { metaEventId: "event-1", metaEventPlayerId: null, userId: "user-1" },
      acceptedDeckId: null,
      resolvedAt: new Date("2026-11-17T00:00:00Z"),
      resolvedByUserId: "admin-1",
      eventOverlayId: "overlay-1",
    });

    const update = queries.findIndex((query) => query.startsWith('update "meta_submissions"'));
    expect(queries[update]).toContain('"event_overlay_id" = $');
    expect(parameters[update]).toContain("overlay-1");
  });

  it("clears the link when a submission goes back to the queue", async () => {
    const { db, queries } = createRecordingDb();

    await metaSubmissionsRepo(db).reopen("submission-1");

    expect(queries[0]).toContain('"event_overlay_id" = $4');
  });
});
