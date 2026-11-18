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
  it("listForUser returns decks", async () => {
    const db = createMockDb([DECK]);
    const repo = decksRepo(db);
    expect(await repo.listForUser("u1")).toEqual([DECK]);
  });

  it("listForUser with includeArchived returns archived decks too", async () => {
    const db = createMockDb([]);
    const repo = decksRepo(db);
    expect(await repo.listForUser("u1", { includeArchived: true })).toEqual([]);
  });

  it("getByIdForUser returns a deck", async () => {
    const db = createMockDb([DECK]);
    const repo = decksRepo(db);
    expect(await repo.getByIdForUser("d-1", "u1")).toEqual(DECK);
  });

  it("getIdAndFormat returns id and format", async () => {
    const db = createMockDb([{ id: "d-1", format: "constructed" }]);
    const repo = decksRepo(db);
    expect(await repo.getIdAndFormat("d-1", "u1")).toEqual({ id: "d-1", format: "constructed" });
  });

  it("exists returns id when found", async () => {
    const db = createMockDb([{ id: "d-1" }]);
    const repo = decksRepo(db);
    expect(await repo.exists("d-1", "u1")).toEqual({ id: "d-1" });
  });

  it("create returns the created deck", async () => {
    const db = createMockDb([DECK]);
    const repo = decksRepo(db);
    const result = await repo.create({
      userId: "u1",
      name: "Aggro",
      description: null,
      format: "constructed",
      formatConfig: null,
      isPublic: false,
    });
    expect(result).toEqual(DECK);
  });

  it("update returns the updated deck", async () => {
    const db = createMockDb([DECK]);
    const repo = decksRepo(db);
    expect(await repo.update("d-1", "u1", { name: "Updated" })).toEqual(DECK);
  });

  it("deleteByIdForUser reports a deleted row", async () => {
    const db = createMockDb({ numDeletedRows: 1n });
    const repo = decksRepo(db);
    expect(await repo.deleteByIdForUser("d-1", "u1")).toBe(true);
  });

  it("setArchivedMany returns the updated decks", async () => {
    const db = createMockDb([DECK]);
    const repo = decksRepo(db);
    expect(await repo.setArchivedMany(["d-1"], "u1", true)).toEqual([DECK]);
  });

  it("setArchivedMany skips the query for no ids", async () => {
    const db = createMockDb([DECK]);
    const repo = decksRepo(db);
    expect(await repo.setArchivedMany([], "u1", true)).toEqual([]);
  });

  it("cardsForDeck returns slim deck card rows", async () => {
    const rows = [{ cardId: "c-1", zone: "main", quantity: 4 }];
    const db = createMockDb(rows);
    const repo = decksRepo(db);
    expect(await repo.cardsForDeck("d-1", "u1")).toEqual(rows);
  });

  it("cardsWithDetails returns deck cards with card info", async () => {
    const rows = [
      {
        id: "dc-1",
        deckId: "d-1",
        cardId: "c-1",
        zone: "main",
        quantity: 4,
        cardName: "Card",
        cardType: "unit",
        domains: [],
        energy: 3,
        might: 2,
        power: 1,
      },
    ];
    const db = createMockDb(rows);
    const repo = decksRepo(db);
    expect(await repo.cardsWithDetails("d-1", "u1")).toEqual(rows);
  });

  it("replaceCards deletes and re-inserts cards in a transaction", async () => {
    const recording = createRecordingDb([[{ version: "42" }]]);
    await expect(
      decksRepo(recording.db).replaceCards("d-1", [
        { cardId: "c-1", zone: "main", quantity: 4, preferredPrintingId: null },
      ]),
    ).resolves.toEqual({ outcome: "replaced", version: "42" });
    expect(recording.queries.map((query) => query.split(" ")[0])).toEqual([
      "update",
      "delete",
      "insert",
    ]);
  });

  it("replaceCards handles empty cards array", async () => {
    const recording = createRecordingDb([[{ version: "42" }]]);
    await expect(decksRepo(recording.db).replaceCards("d-1", [])).resolves.toEqual({
      outcome: "replaced",
      version: "42",
    });
  });

  it("replaceCards reports a deck that no longer exists", async () => {
    const recording = createRecordingDb([[]]);
    await expect(decksRepo(recording.db).replaceCards("d-1", [])).resolves.toEqual({
      outcome: "missing",
    });
  });

  it("replaceCards writes only while the deck is at the expected version", async () => {
    const recording = createRecordingDb([[{ version: "42" }]]);
    await decksRepo(recording.db).replaceCards("d-1", [], "41");
    expect(recording.queries[0]).toContain("updated_xid = $");
    expect(recording.parameters[0]).toContain("41");
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
