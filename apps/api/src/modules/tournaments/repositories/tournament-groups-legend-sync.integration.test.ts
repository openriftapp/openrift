import { sql } from "kysely";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createRepos } from "../../../deps.js";
import { createTestContext, insertCard, req } from "../../../test/integration-context.js";
import { readJson } from "../../../test/read-json.js";
import { holdRow, waitUntilBlockedBy } from "../../../test/row-locks.js";
import type { NewDeckCheckEntryCard } from "./deck-check-entry-cards.js";

const HOST_ID = crypto.randomUUID();
const CARD_SLUG = `legend-sync-${HOST_ID.slice(0, 8)}`;
const ctx = createTestContext(HOST_ID, `test-${HOST_ID}@test.com`);

describe.skipIf(!ctx)("syncParticipantLegendsFromDeckCheck (integration)", () => {
  const { app, db } = ctx!;
  const repos = createRepos(db);
  let jinx = "";
  let viktor = "";
  let unit = "";
  let tournamentId = "";
  let participantId = "";

  function line(
    sortOrder: number,
    zone: string,
    resolvedCardId: string | null,
  ): NewDeckCheckEntryCard {
    return {
      sortOrder,
      rawName: `Line ${sortOrder}`,
      section: zone,
      zone,
      quantity: 1,
      resolvedCardId,
      resolvedPrintingId: null,
      matchStatus: resolvedCardId === null ? "unmatched" : "matched",
    };
  }

  async function addList(
    cards: NewDeckCheckEntryCard[],
    options: { submittedAt?: Date; withdrawn?: boolean } = {},
  ): Promise<string> {
    const entry = await repos.deckCheck.createEntry({
      tournamentId,
      participantId,
      externalId: `manual:${crypto.randomUUID()}`,
      submittedAt: options.submittedAt ?? null,
      contentHash: crypto.randomUUID(),
      withdrawnAt: options.withdrawn ? new Date() : null,
      state: options.withdrawn ? "withdrawn" : "submitted",
    });
    await repos.deckCheck.replaceEntryCards(entry.id, cards);
    return entry.id;
  }

  async function storedLegend(): Promise<string | null> {
    const row = await db
      .selectFrom("tournamentParticipants")
      .select("legendCardId")
      .where("id", "=", participantId)
      .executeTakeFirstOrThrow();
    return row.legendCardId;
  }

  beforeAll(async () => {
    await db
      .insertInto("users")
      .values({
        id: HOST_ID,
        email: `test-${HOST_ID}@test.com`,
        name: "Legend Sync Host",
        emailVerified: true,
        image: null,
      })
      .execute();
    const jinxCard = await insertCard(db, {
      slug: `${CARD_SLUG}-jinx`,
      name: "Jinx",
      types: ["legend"],
    });
    const viktorCard = await insertCard(db, {
      slug: `${CARD_SLUG}-viktor`,
      name: "Viktor",
      types: ["legend"],
    });
    const unitCard = await insertCard(db, {
      slug: `${CARD_SLUG}-unit`,
      name: "Poro",
      types: ["unit"],
    });
    jinx = jinxCard.id;
    viktor = viktorCard.id;
    unit = unitCard.id;
  });

  beforeEach(async () => {
    const res = await app.fetch(
      req("POST", "/tournaments", {
        name: "Summoner Skirmish",
        host: { type: "user" },
        pairingStyle: "none",
        deckSubmission: "required",
        startsAt: "2026-06-01T12:00:00Z",
      }),
    );
    expect(res.status).toBe(201);
    tournamentId = ((await readJson(res)) as { id: string }).id;
    const participant = await repos.tournaments.createParticipant({
      tournamentId,
      displayName: "Piltover Pat",
      status: "active",
    });
    participantId = participant.id;
  });

  afterAll(async () => {
    await db.deleteFrom("tournaments").where("hostUserId", "=", HOST_ID).execute();
    await db.deleteFrom("cards").where("slug", "like", `${CARD_SLUG}%`).execute();
    await db.deleteFrom("users").where("id", "=", HOST_ID).execute();
  });

  it("sets the legend from the list's Legend zone", async () => {
    await addList([line(0, "legend", jinx), line(1, "main", unit)]);

    await repos.tournamentGroups.syncParticipantLegendsFromDeckCheck(tournamentId, [participantId]);

    expect(await storedLegend()).toBe(jinx);
  });

  it("replaces a hand-set legend when the list names another", async () => {
    await db
      .updateTable("tournamentParticipants")
      .set({ legendCardId: viktor })
      .where("id", "=", participantId)
      .execute();
    await addList([line(0, "legend", jinx)]);

    await repos.tournamentGroups.syncParticipantLegendsFromDeckCheck(tournamentId);

    expect(await storedLegend()).toBe(jinx);
  });

  it("keeps the stored legend when the list's Legend line is unresolved or not a Legend", async () => {
    await db
      .updateTable("tournamentParticipants")
      .set({ legendCardId: viktor })
      .where("id", "=", participantId)
      .execute();
    await addList([line(0, "legend", null), line(1, "legend", unit)]);

    await repos.tournamentGroups.syncParticipantLegendsFromDeckCheck(tournamentId, [participantId]);

    expect(await storedLegend()).toBe(viktor);
  });

  it("reads the newest non-withdrawn list only", async () => {
    await addList([line(0, "legend", viktor)], { submittedAt: new Date("2026-06-01T10:00:00Z") });
    await addList([line(0, "legend", jinx)], { submittedAt: new Date("2026-06-01T11:00:00Z") });
    await addList([line(0, "legend", unit)], {
      submittedAt: new Date("2026-06-01T12:00:00Z"),
      withdrawn: true,
    });

    await repos.tournamentGroups.syncParticipantLegendsFromDeckCheck(tournamentId, [participantId]);

    expect(await storedLegend()).toBe(jinx);
  });

  it("leaves the legend alone once groups exist", async () => {
    await db.insertInto("tournamentGroups").values({ tournamentId, label: "A" }).execute();
    await addList([line(0, "legend", jinx)]);

    await repos.tournamentGroups.syncParticipantLegendsFromDeckCheck(tournamentId, [participantId]);

    expect(await storedLegend()).toBeNull();
  });

  it("leaves the legend alone when the groups were drawn while it waited", async () => {
    await addList([line(0, "legend", jinx)]);
    const generator = await holdRow(
      db,
      sql`WITH drawn AS (
        INSERT INTO tournament_groups (tournament_id, label) VALUES (${tournamentId}, 'A') RETURNING id
      ) UPDATE tournament_participants SET group_id = (SELECT id FROM drawn), group_slot = 0
        WHERE id = ${participantId}`,
    );
    let synced: Promise<void> | undefined;
    try {
      synced = repos.tournamentGroups.syncParticipantLegendsFromDeckCheck(tournamentId, [
        participantId,
      ]);
      await waitUntilBlockedBy(db, generator.pid);
    } finally {
      await generator.release();
    }
    await synced;

    expect(await storedLegend()).toBeNull();
  });
});
