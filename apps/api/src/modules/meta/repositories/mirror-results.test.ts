import type { Insertable } from "kysely";
import { describe, expect, it } from "vitest";

import type {
  TopdeckDecklistsTable,
  TopdeckEventStandingsTable,
} from "../../../db/tables/meta-sources.js";
import { createRecordingDb } from "../../../test/recording-db.js";
import {
  cardsByShortCode,
  deckCoverageOf,
  putMirrorDecklist,
  replaceRows,
  replaceUnderEventLock,
} from "./mirror-results.js";

function standingsReplace(rows: Insertable<TopdeckEventStandingsTable>[]) {
  return replaceRows(
    (trx) => trx.deleteFrom("topdeckEventStandings").where("tid", "=", "t1").execute(),
    rows,
    (trx, batch) => trx.insertInto("topdeckEventStandings").values(batch).execute(),
  );
}

function decklistsReplace(rows: Insertable<TopdeckDecklistsTable>[]) {
  return replaceRows(
    (trx) => trx.deleteFrom("topdeckDecklists").where("tid", "=", "t1").execute(),
    rows,
    (trx, batch) => trx.insertInto("topdeckDecklists").values(batch).execute(),
  );
}

describe("replaceUnderEventLock", () => {
  it("takes the event lock, clears every table, then inserts, in one transaction", async () => {
    const recording = createRecordingDb();

    await replaceUnderEventLock(
      recording.db,
      "topdeck",
      "t1",
      standingsReplace([{ tid: "t1", playerKey: "a", playerName: "Ahri" }]),
      decklistsReplace([{ sourceDeckId: "d1", tid: "t1", fetchStatus: "fetched" }]),
    );

    expect(recording.events).toEqual(["begin", "commit"]);
    expect(recording.queries.map((query) => query.split(" ").slice(0, 3).join(" "))).toEqual([
      "select pg_advisory_xact_lock(hashtext($1))",
      'delete from "topdeck_event_standings"',
      'delete from "topdeck_decklists"',
      'insert into "topdeck_event_standings"',
      'insert into "topdeck_decklists"',
    ]);
    expect(recording.parameters[0]).toEqual(["topdeck-event:t1"]);
  });

  it("clears without inserting when the source sent no rows", async () => {
    const recording = createRecordingDb();

    await replaceUnderEventLock(recording.db, "playloltcg", 7, standingsReplace([]));

    expect(recording.parameters[0]).toEqual(["playloltcg-event:7"]);
    expect(recording.queries).toHaveLength(2);
    expect(recording.queries[1]).toContain('delete from "topdeck_event_standings"');
  });
});

describe("putMirrorDecklist", () => {
  it("upserts the deck and replaces its cards in a transaction without an event lock", async () => {
    const recording = createRecordingDb();

    await putMirrorDecklist(
      recording.db,
      (trx) =>
        trx
          .updateTable("topdeckDecklists")
          .set({ fetchStatus: "fetched" })
          .where("sourceDeckId", "=", "d1")
          .execute(),
      standingsReplace([{ tid: "t1", playerKey: "a", playerName: "Ahri" }]),
    );

    expect(recording.events).toEqual(["begin", "commit"]);
    expect(recording.queries.map((query) => query.split(" ").slice(0, 2).join(" "))).toEqual([
      'update "topdeck_decklists"',
      "delete from",
      "insert into",
    ]);
  });
});

describe("deckCoverageOf", () => {
  it("lists referenced decks not held yet and counts the held ones", () => {
    expect(deckCoverageOf(["a", null, "b", "c"], new Set(["b", "z"]))).toEqual({
      outstanding: ["a", "c"],
      held: 2,
    });
  });

  it("reports nothing outstanding when every referenced deck is held", () => {
    expect(deckCoverageOf(["a"], new Set(["a"]))).toEqual({ outstanding: [], held: 1 });
  });
});

describe("cardsByShortCode", () => {
  it("reads nothing for no codes", async () => {
    const recording = createRecordingDb();

    await expect(cardsByShortCode(recording.db, "EN", [])).resolves.toEqual(new Map());
    expect(recording.queries).toHaveLength(0);
  });

  it("asks once per distinct code in the given language and keeps the first card per code", async () => {
    const recording = createRecordingDb([
      [
        { short_code: "OGN-1", card_id: "c1", name: "Jinx", type: "unit" },
        { short_code: "OGN-1", card_id: "c9", name: "Jinx", type: "unit" },
        { short_code: "OGN-2", card_id: "c2", name: "Vi", type: "legend" },
      ],
    ]);

    const map = await cardsByShortCode(recording.db, "SC", ["OGN-1", "OGN-2", "OGN-1"]);

    expect(recording.parameters[0]).toEqual(["SC", "OGN-1", "OGN-2"]);
    expect(map).toEqual(
      new Map([
        ["OGN-1", { cardId: "c1", name: "Jinx", type: "unit" }],
        ["OGN-2", { cardId: "c2", name: "Vi", type: "legend" }],
      ]),
    );
  });
});
