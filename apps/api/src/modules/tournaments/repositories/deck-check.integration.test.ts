import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRepos } from "../../../deps.js";
import { createDbContext, seedTestUser } from "../../../test/integration-context.js";

const HOST_ID = crypto.randomUUID();
const ctx = createDbContext(HOST_ID);

describe.skipIf(!ctx)("deckCheckRepo (integration)", () => {
  const { db } = ctx!;
  const repos = createRepos(db);

  beforeAll(async () => {
    await seedTestUser(db, { id: HOST_ID });
  });

  afterAll(async () => {
    await db.deleteFrom("tournaments").where("hostUserId", "=", HOST_ID).execute();
    await db.deleteFrom("users").where("id", "=", HOST_ID).execute();
  });

  async function entryWithLine(quantity: number) {
    const tournament = await repos.tournaments.create({
      hostType: "user",
      hostUserId: HOST_ID,
      name: "Summoner Skirmish",
      pairingStyle: "none",
      deckSubmission: "required",
    });
    const participant = await repos.tournaments.createParticipant({
      tournamentId: tournament.id,
      displayName: "Piltover Pat",
      status: "active",
    });
    const entry = await repos.deckCheck.createEntry({
      tournamentId: tournament.id,
      participantId: participant.id,
      externalId: `manual:${crypto.randomUUID()}`,
      submittedAt: null,
      contentHash: crypto.randomUUID(),
      withdrawnAt: null,
      state: "submitted",
    });
    await repos.deckCheck.replaceEntryCards(entry.id, [
      {
        sortOrder: 0,
        rawName: "Poro Snax",
        section: "main",
        zone: "main",
        quantity,
        resolvedCardId: null,
        resolvedPrintingId: null,
        matchStatus: "unmatched",
      },
    ]);
    const line = await db
      .selectFrom("deckCheckEntryCards")
      .select("id")
      .where("entryId", "=", entry.id)
      .executeTakeFirstOrThrow();
    return { entryId: entry.id, lineId: line.id, participantId: participant.id };
  }

  async function quantityOf(lineId: string): Promise<number | undefined> {
    const row = await db
      .selectFrom("deckCheckEntryCards")
      .select("quantity")
      .where("id", "=", lineId)
      .executeTakeFirst();
    return row?.quantity;
  }

  describe("deleteEntryCardCopy", () => {
    it("takes one copy off a line that holds several", async () => {
      const { entryId, lineId } = await entryWithLine(3);

      expect(await repos.deckCheck.deleteEntryCardCopy(entryId, lineId, 1)).toBe(true);
      expect(await quantityOf(lineId)).toBe(2);
    });

    it("deletes the line when its last copy goes", async () => {
      const { entryId, lineId } = await entryWithLine(1);

      expect(await repos.deckCheck.deleteEntryCardCopy(entryId, lineId, 0)).toBe(true);
      expect(await quantityOf(lineId)).toBeUndefined();
    });

    it("writes nothing when the copy index is past the line's quantity", async () => {
      const { entryId, lineId } = await entryWithLine(2);

      expect(await repos.deckCheck.deleteEntryCardCopy(entryId, lineId, 5)).toBe(false);
      expect(await quantityOf(lineId)).toBe(2);
    });

    it("lets concurrent removals of the last copies all land", async () => {
      const { entryId, lineId } = await entryWithLine(2);

      const results = await Promise.all([
        repos.deckCheck.deleteEntryCardCopy(entryId, lineId, 0),
        repos.deckCheck.deleteEntryCardCopy(entryId, lineId, 0),
      ]);

      expect(results).toEqual([true, true]);
      expect(await quantityOf(lineId)).toBeUndefined();
    });
  });

  describe("updateEntry", () => {
    it("writes the participant's name and the entry's state together", async () => {
      const { entryId, participantId } = await entryWithLine(1);

      const updated = await repos.deckCheck.updateEntry(entryId, {
        playerName: "Zaun Zed",
        state: "submitted",
      });

      const participant = await db
        .selectFrom("tournamentParticipants")
        .select("displayName")
        .where("id", "=", participantId)
        .executeTakeFirstOrThrow();
      expect(participant.displayName).toBe("Zaun Zed");
      expect(updated?.state).toBe("submitted");
    });
  });
});
