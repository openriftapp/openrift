import { describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { createRecordingDb } from "../../../test/recording-db.js";
import { decksRepo } from "./decks.js";

const DECK = {
  id: "d-1",
  userId: "u1",
  name: "Aggro",
  description: null,
  format: "constructed",
  formatConfig: null,
  oddsConfig: null,
  isPublic: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("decksRepo", () => {
  it("setArchivedMany skips the query for no ids", async () => {
    const db = createMockDb([DECK]);
    const repo = decksRepo(db);
    expect(await repo.setArchivedMany([], "u1", true)).toEqual([]);
  });

  it("replaceCards reports a deck that no longer exists", async () => {
    const recording = createRecordingDb([[]]);
    await expect(decksRepo(recording.db).replaceCards("d-1", [])).resolves.toEqual({
      outcome: "missing",
    });
  });

  it("replaceCards answers the stored version and cards when the deck moved on", async () => {
    const stored = { card_id: "c-1", zone: "main", quantity: 2, preferred_printing_id: null };
    const recording = createRecordingDb([[], [{ version: "57" }], [stored]]);
    await expect(decksRepo(recording.db).replaceCards("d-1", [], "41")).resolves.toEqual({
      outcome: "stale",
      version: "57",
      cards: [{ cardId: "c-1", zone: "main", quantity: 2, preferredPrintingId: null }],
    });
    expect(recording.queries[1]).toMatch(/ for share$/u);
    expect(recording.queries.some((query) => query.startsWith("delete"))).toBe(false);
  });

  it("replaceCards reports a missing deck when a versioned write finds none", async () => {
    const recording = createRecordingDb([[], []]);
    await expect(decksRepo(recording.db).replaceCards("d-1", [], "41")).resolves.toEqual({
      outcome: "missing",
    });
  });
});
