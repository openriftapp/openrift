import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { tournamentGroupsRepo } from "./tournament-groups.js";

const RESULTS = [
  { playerId: "p-1", placement: 2 },
  { playerId: "p-2", placement: 1 },
];

describe("setWalkoverResult", () => {
  it("claims the pod only while its result is still pending", async () => {
    const recording = createRecordingDb([[], [{ id: "pod-1" }]]);

    await tournamentGroupsRepo(recording.db).setWalkoverResult("pod-1", RESULTS);

    const podUpdate = recording.queries.findIndex((query) => query.startsWith('update "pods"'));
    expect(recording.queries[podUpdate]).toContain('"result_status" = $');
    expect(recording.parameters[podUpdate]).toContain("pending");
    const memberUpdates = recording.queries.flatMap((query, index) =>
      query.startsWith('update "pod_members"') ? [index] : [],
    );
    expect(memberUpdates).toHaveLength(2);
    expect(memberUpdates.every((index) => index > podUpdate)).toBe(true);
  });

  it("leaves the members alone when a result was reported first", async () => {
    const recording = createRecordingDb([[], []]);

    await tournamentGroupsRepo(recording.db).setWalkoverResult("pod-1", RESULTS);

    expect(recording.queries.some((query) => query.startsWith('update "pod_members"'))).toBe(false);
  });
});
