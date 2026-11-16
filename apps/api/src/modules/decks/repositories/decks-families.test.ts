import { describe, expect, it } from "vitest";

import type { RecordingDb, StubResult } from "../../../test/recording-db.js";
import { createRecordingDb } from "../../../test/recording-db.js";
import { decksCoreRepo } from "./decks-core.js";
import { decksFamiliesRepo } from "./decks-families.js";

const USER = "u-1";
const DECK_ROW = {
  id: "d-current",
  user_id: USER,
  family_id: null,
  is_primary: false,
  predecessor_deck_id: null,
};

function deckUpdates(recorded: RecordingDb): { sql: string; parameters: readonly unknown[] }[] {
  return recorded.statements
    .filter((statement) => statement.sql.startsWith('update "decks"'))
    .map((statement) => ({ sql: statement.sql, parameters: statement.parameters }));
}

function expectOwnerLockedBeforeDecks(recorded: RecordingDb): void {
  const ownerLock = recorded.queries.findIndex(
    (query) => query.includes('from "users"') && query.endsWith("for key share"),
  );
  const firstDeckStatement = recorded.queries.findIndex((query) => query.includes('"decks"'));
  expect(ownerLock).toBe(1);
  expect(recorded.parameters[ownerLock]).toEqual([USER]);
  expect(firstDeckStatement).toBeGreaterThan(ownerLock);
}

describe("decksFamiliesRepo lock order", () => {
  it("createVariantCopy key-shares the owner before locking the source deck", async () => {
    const recorded = createRecordingDb([[], [], [DECK_ROW], new Error("stop after the source")]);
    await expect(
      decksFamiliesRepo(recorded.db).createVariantCopy("d-current", USER, {}),
    ).rejects.toThrow("stop after the source");
    expectOwnerLockedBeforeDecks(recorded);
    expect(recorded.queries[2]).toContain("for update");
  });

  it("createVariantCopy takes no deck lock for a deck the owner does not have", async () => {
    const recorded = createRecordingDb([[], [], []]);
    expect(
      await decksFamiliesRepo(recorded.db).createVariantCopy("d-missing", USER, {}),
    ).toBeUndefined();
    expect(recorded.statements).toHaveLength(3);
    expectOwnerLockedBeforeDecks(recorded);
  });

  it("linkAsVariant writes two standalone decks in one statement", async () => {
    const other = { ...DECK_ROW, id: "d-other" };
    const results: StubResult[] = [[], [], [DECK_ROW, other], [], [], []];
    const recorded = createRecordingDb(results);
    recorded.setRows([DECK_ROW]);

    await decksFamiliesRepo(recorded.db).linkAsVariant("d-current", USER, {
      otherDeckId: "d-other",
      markAsPreviousVersion: true,
    });

    expectOwnerLockedBeforeDecks(recorded);
    const updates = deckUpdates(recorded);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.sql).toBe(
      'update "decks" set "family_id" = $1, "is_primary" = "id" = $2, "predecessor_deck_id" = case when "id" = $3 then $4 else "predecessor_deck_id" end where "user_id" = $5 and "id" in ($6, $7)',
    );
    expect(updates[0]?.parameters).toEqual([
      expect.any(String),
      "d-current",
      "d-current",
      "d-other",
      USER,
      "d-current",
      "d-other",
    ]);
  });

  it("linkAsVariant keeps the joined family's primary when a standalone deck joins", async () => {
    const other = { ...DECK_ROW, id: "d-other", family_id: "f-right" };
    const primaries = [{ id: "d-right-primary", family_id: "f-right" }];
    const recorded = createRecordingDb([[], [], [DECK_ROW, other], [], primaries, []]);
    recorded.setRows([DECK_ROW]);

    await decksFamiliesRepo(recorded.db).linkAsVariant("d-current", USER, {
      otherDeckId: "d-other",
    });

    const updates = deckUpdates(recorded);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.sql).toBe(
      'update "decks" set "family_id" = $1, "is_primary" = "id" = $2 where "user_id" = $3 and "id" in ($4, $5)',
    );
    expect(updates[0]?.parameters).toEqual([
      "f-right",
      "d-right-primary",
      USER,
      "d-right-primary",
      "d-current",
    ]);
  });

  it("linkAsVariant writes a merge of two families in one statement", async () => {
    const current = { ...DECK_ROW, family_id: "f-left" };
    const other = { ...DECK_ROW, id: "d-other", family_id: "f-right", is_primary: true };
    const primaries = [
      { id: "d-other", family_id: "f-right" },
      { id: "d-left-primary", family_id: "f-left" },
    ];
    const recorded = createRecordingDb([[], [], [current, other], [], primaries, [], [], []]);
    recorded.setRows([current]);

    await decksFamiliesRepo(recorded.db).linkAsVariant("d-current", USER, {
      otherDeckId: "d-other",
    });

    expectOwnerLockedBeforeDecks(recorded);
    const updates = deckUpdates(recorded);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.sql).toBe(
      'update "decks" set "family_id" = $1, "is_primary" = "id" = $2 where "user_id" = $3 and ("id" in ($4, $5) or "family_id" in ($6))',
    );
    expect(updates[0]?.parameters).toEqual([
      "f-left",
      "d-left-primary",
      USER,
      "d-left-primary",
      "d-current",
      "f-right",
    ]);
  });

  it("setPredecessor key-shares the owner before locking the target deck", async () => {
    const target = { id: "d-current", family_id: "f-1" };
    const parent = { id: "d-parent", family_id: "f-1" };
    const recorded = createRecordingDb([[], [], [target], [parent], [target, parent], [DECK_ROW]]);

    await decksFamiliesRepo(recorded.db).setPredecessor("d-current", USER, "d-parent");

    expectOwnerLockedBeforeDecks(recorded);
    expect(recorded.queries[2]).toContain("for update");
    expect(deckUpdates(recorded)).toHaveLength(1);
  });

  it("unlinkVariant writes a spliced survivor that takes over the primary once", async () => {
    const departing = {
      ...DECK_ROW,
      family_id: "f-1",
      is_primary: true,
      predecessor_deck_id: "d-oldest",
    };
    const survivors = [
      { id: "d-newest", predecessor_deck_id: "d-current" },
      { id: "d-oldest", predecessor_deck_id: null },
    ];
    const recorded = createRecordingDb([[], [], [departing], [], survivors, [], [], []]);
    recorded.setRows([departing]);

    await decksFamiliesRepo(recorded.db).unlinkVariant("d-current", USER);

    expectOwnerLockedBeforeDecks(recorded);
    const updates = deckUpdates(recorded);
    expect(updates).toHaveLength(2);
    expect(updates[0]?.parameters).toContain("d-current");
    expect(updates[1]?.parameters).toEqual(["d-current", "d-oldest", "d-newest", "d-newest"]);
  });

  it("unlinkVariant clears a sole survivor that descended from the departing deck once", async () => {
    const departing = { ...DECK_ROW, family_id: "f-1", is_primary: true };
    const survivors = [{ id: "d-survivor", predecessor_deck_id: "d-current" }];
    const recorded = createRecordingDb([[], [], [departing], [], survivors, [], [], []]);
    recorded.setRows([departing]);

    await decksFamiliesRepo(recorded.db).unlinkVariant("d-current", USER);

    const updates = deckUpdates(recorded);
    expect(updates).toHaveLength(2);
    expect(updates.map((update) => update.parameters.at(-1))).toEqual(["d-current", "d-survivor"]);
  });

  it("unlinkVariant leaves survivors alone when a non-primary leaf leaves", async () => {
    const departing = { ...DECK_ROW, family_id: "f-1", predecessor_deck_id: "d-primary" };
    const survivors = [
      { id: "d-primary", predecessor_deck_id: null },
      { id: "d-sibling", predecessor_deck_id: "d-primary" },
    ];
    const recorded = createRecordingDb([[], [], [departing], [], survivors, [], []]);
    recorded.setRows([departing]);

    await decksFamiliesRepo(recorded.db).unlinkVariant("d-current", USER);

    expect(deckUpdates(recorded)).toHaveLength(1);
  });
});

describe("deleteByIdForUser lock order", () => {
  function deleteIndex(recorded: RecordingDb): number {
    return recorded.queries.findIndex((query) => query.startsWith('delete from "decks"'));
  }

  function deleteWith(target: Record<string, unknown>, survivors: Record<string, unknown>[]) {
    const recorded = createRecordingDb([[], [], [{ family_id: "f-1" }], [], [target], survivors]);
    return { recorded, done: decksCoreRepo(recorded.db).deleteByIdForUser("d-current", USER) };
  }

  it("promotes a survivor before the delete, clearing its pointer in the same write", async () => {
    const { recorded, done } = deleteWith({ family_id: "f-1", is_primary: true }, [
      { id: "d-newest", predecessor_deck_id: "d-current" },
      { id: "d-other", predecessor_deck_id: "d-current" },
    ]);
    expect(await done).toBe(true);

    expectOwnerLockedBeforeDecks(recorded);
    const updates = deckUpdates(recorded);
    expect(updates).toHaveLength(2);
    expect(updates[0]?.sql).toBe('update "decks" set "is_primary" = $1 where "id" = $2');
    expect(updates[0]?.parameters).toEqual([false, "d-current"]);
    expect(updates[1]?.sql).toBe(
      'update "decks" set "is_primary" = $1, "predecessor_deck_id" = $2 where "id" = $3',
    );
    expect(updates[1]?.parameters).toEqual([true, null, "d-newest"]);
    const lastUpdate = recorded.queries.findLastIndex((query) =>
      query.startsWith('update "decks"'),
    );
    expect(deleteIndex(recorded)).toBeGreaterThan(lastUpdate);
  });

  it("keeps a promoted survivor's own pointer when it descends from another deck", async () => {
    const { recorded, done } = deleteWith({ family_id: "f-1", is_primary: true }, [
      { id: "d-newest", predecessor_deck_id: "d-other" },
      { id: "d-other", predecessor_deck_id: "d-current" },
    ]);
    await done;

    expect(deckUpdates(recorded)[1]?.parameters).toEqual([true, "d-newest"]);
  });

  it("clears a sole survivor before the delete", async () => {
    const { recorded, done } = deleteWith({ family_id: "f-1", is_primary: false }, [
      { id: "d-survivor", predecessor_deck_id: "d-current" },
    ]);
    await done;

    const updates = deckUpdates(recorded);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.parameters).toEqual([null, false, null, "d-survivor"]);
    expect(deleteIndex(recorded)).toBeGreaterThan(
      recorded.queries.findIndex((query) => query.startsWith('update "decks"')),
    );
  });

  it("leaves the survivors to the delete when a non-primary member goes", async () => {
    const { recorded, done } = deleteWith({ family_id: "f-1", is_primary: false }, [
      { id: "d-primary", predecessor_deck_id: null },
      { id: "d-sibling", predecessor_deck_id: "d-current" },
    ]);
    await done;

    expectOwnerLockedBeforeDecks(recorded);
    expect(deckUpdates(recorded)).toHaveLength(0);
    expect(deleteIndex(recorded)).toBeGreaterThan(0);
  });
});
