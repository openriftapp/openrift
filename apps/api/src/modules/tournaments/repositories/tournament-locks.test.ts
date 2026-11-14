import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { tournamentGroupsRepo } from "./tournament-groups.js";
import { tournamentsCoreRepo } from "./tournaments-core.js";

describe("tournament write lock", () => {
  it("takes the same lock for round edits and group-stage writes", async () => {
    const rounds = createRecordingDb();
    await tournamentsCoreRepo(rounds.db).lockRounds("t-1");

    const stage = createRecordingDb([[], new Error("stop after the lock")]);
    await expect(
      tournamentGroupsRepo(stage.db).insertGroupPods("t-1", "r-1", [
        { podNumber: 1, playerIds: ["p-1", "p-2"], placements: null },
      ]),
    ).rejects.toThrow("stop after the lock");

    expect(rounds.statements).toHaveLength(1);
    expect(rounds.queries[0]).toBe("select pg_advisory_xact_lock(hashtext($1))");
    expect(rounds.parameters[0]).toEqual(["t-1"]);
    expect(stage.queries[0]).toBe(rounds.queries[0]);
    expect(stage.parameters[0]).toEqual(rounds.parameters[0]);
  });
});
