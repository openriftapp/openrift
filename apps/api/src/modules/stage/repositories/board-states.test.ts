import { emptyBoardDocument } from "@openrift/shared/board-state";
import { describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { createRecordingDb } from "../../../test/recording-db.js";
import { boardStatesRepo } from "./board-states.js";

function row(id: string, document: unknown) {
  return {
    id,
    userId: "u1",
    title: id,
    coreRulesVersion: null,
    tournamentRulesVersion: null,
    document,
    isPublic: false,
    shareToken: null,
    isFeatured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const GOOD = row("good", emptyBoardDocument());
const BROKEN = row("broken", { schemaVersion: 99 });

describe("boardStatesRepo", () => {
  it("leaves an unreadable document out of the owner's list", async () => {
    const repo = boardStatesRepo(createMockDb([GOOD, BROKEN]));

    const rows = await repo.listForUser("u1");

    expect(rows.map((entry) => entry.id)).toEqual(["good"]);
  });

  it("answers an unreadable document as missing on the single reads", async () => {
    const repo = boardStatesRepo(createMockDb([BROKEN]));

    expect(await repo.getByIdForUser("broken", "u1")).toBeUndefined();
    expect(await repo.getById("broken")).toBeUndefined();
    expect(await repo.update("broken", "u1", { title: "New" })).toBeUndefined();
  });

  it("answers an unreadable shared board as missing", async () => {
    const repo = boardStatesRepo(
      createMockDb([{ ...BROKEN, ownerName: "Ahri", ownerEmail: "a@x.test" }]),
    );

    expect(await repo.getByShareToken("tok")).toBeUndefined();
  });

  it("reads the pins of a board without its document", async () => {
    const recorded = createRecordingDb([
      [{ id: "broken", core_rules_version: null, tournament_rules_version: null }],
    ]);

    expect(await boardStatesRepo(recorded.db).getPinsForUser("broken", "u1")).toEqual({
      id: "broken",
      coreRulesVersion: null,
      tournamentRulesVersion: null,
    });
    expect(recorded.queries[0]).not.toContain('"document"');
  });

  it("still deletes a board whose document is unreadable", async () => {
    const repo = boardStatesRepo(createMockDb({ numDeletedRows: 1n }));

    expect(await repo.deleteByIdForUser("broken", "u1")).toBe(true);
  });

  it("returns a readable document", async () => {
    const repo = boardStatesRepo(createMockDb([GOOD]));

    const found = await repo.getByIdForUser("good", "u1");

    expect(found?.id).toBe("good");
  });
});
