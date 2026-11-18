import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbContext } from "../../../test/integration-context.js";
import { topdeckResultsRepo } from "./topdeck-results.js";

// The mirror has no provider column, so isolation is by key: every tid and
// deck id this file writes carries the `mrr-` prefix.

const ctx = createDbContext(crypto.randomUUID());

const TID = "mrr-event";
const DECK_ID = "mrr-deck";

const FIRST_FETCH = new Date("2026-09-01T12:00:00Z");
const SECOND_FETCH = new Date("2026-09-02T12:00:00Z");

describe.skipIf(!ctx)("putMirrorDecklist (integration)", () => {
  const { db } = ctx!;
  const repo = topdeckResultsRepo(db);

  async function storedDeck() {
    const deck = await db
      .selectFrom("topdeckDecklists")
      .select(["fetchStatus", "fetchedAt"])
      .where("sourceDeckId", "=", DECK_ID)
      .executeTakeFirst();
    const byDeck = await repo.decklistCards(TID);
    const cards = byDeck.get(DECK_ID) ?? [];
    return { deck, cards: cards.map((card) => card.cardName) };
  }

  beforeAll(async () => {
    await db
      .insertInto("topdeckEvents")
      .values({
        tid: TID,
        name: "MRR Summoner Skirmish",
        format: "Constructed",
        startAt: new Date("2026-08-30T18:00:00Z"),
        contentHash: "mrr-hash",
        lastSeenAt: FIRST_FETCH,
      })
      .execute();
    await repo.putDecklist(
      { sourceDeckId: DECK_ID, tid: TID, fetchStatus: "fetched", fetchedAt: FIRST_FETCH },
      [
        { lineNumber: 0, zone: "main", quantity: 3, cardName: "Ahri" },
        { lineNumber: 1, zone: "main", quantity: 2, cardName: "Garen" },
      ],
    );
  });

  afterAll(async () => {
    await db.deleteFrom("topdeckEvents").where("tid", "=", TID).execute();
  });

  it("updates the deck row and replaces its cards on a second put", async () => {
    await repo.putDecklist(
      { sourceDeckId: DECK_ID, tid: TID, fetchStatus: "fetched", fetchedAt: SECOND_FETCH },
      [{ lineNumber: 0, zone: "main", quantity: 1, cardName: "Jinx" }],
    );

    expect(await storedDeck()).toEqual({
      deck: { fetchStatus: "fetched", fetchedAt: SECOND_FETCH },
      cards: ["Jinx"],
    });
  });

  it("keeps the previous deck and cards when the card insert fails", async () => {
    const before = await storedDeck();

    await expect(
      repo.putDecklist(
        { sourceDeckId: DECK_ID, tid: TID, fetchStatus: "refused", fetchedAt: FIRST_FETCH },
        [{ lineNumber: 0, zone: "main", quantity: 0, cardName: "Teemo" }],
      ),
    ).rejects.toThrow();

    expect(await storedDeck()).toEqual(before);
  });
});
