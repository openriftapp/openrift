import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRepos } from "../../../deps.js";
import { CARD_FURY_UNIT } from "../../../test/fixtures/constants.js";
import { createTestContext, req } from "../../../test/integration-context.js";
import { readJson } from "../../../test/read-json.js";

const HOST_ID = crypto.randomUUID();
const STRANGER_ID = crypto.randomUUID();
const EVENT_ID = "117163142476069250";
const SAVED = "2026-11-16T08:55:34.591217Z";

const hostCtx = createTestContext(HOST_ID);
const strangerCtx = createTestContext(STRANGER_ID);

function registrant(playerId: string, overrides: Record<string, unknown> = {}) {
  return {
    playerId,
    displayName: `Player ${playerId}`,
    tagLine: "EUW",
    dropped: false,
    deck: {
      deckText: `Legend:\n1 Lillia, Bashful Bloom\n\nMainDeck:\n3 ${CARD_FURY_UNIT.name}`,
      lastSavedAt: SAVED,
    },
    ...overrides,
  };
}

function payload(registrants: unknown[], eventId = EVENT_ID) {
  return {
    event: { eventId, name: "Summoner Skirmish", startsAt: "2026-11-22T13:00:00Z" },
    registrants,
    readAt: "2026-11-17T10:00:00Z",
  };
}

describe.skipIf(!hostCtx)("playriftbound sync (integration)", () => {
  const { db } = hostCtx!;
  const hostApp = hostCtx!.app;
  const strangerApp = strangerCtx!.app;
  const repos = createRepos(db);
  let tournamentId: string;
  let deckless: string;

  async function sync(registrants: unknown[], eventId = EVENT_ID, target = tournamentId) {
    return hostApp.fetch(
      req("POST", "/tournaments/playriftbound/sync", {
        tournamentId: target,
        payload: payload(registrants, eventId),
      }),
    );
  }

  async function entryOf(playerId: string) {
    return repos.deckCheck.getEntryByExternalId(tournamentId, `playriftbound:${playerId}`);
  }

  beforeAll(async () => {
    for (const id of [HOST_ID, STRANGER_ID]) {
      await db
        .insertInto("users")
        .values({
          id,
          email: `test-${id}@test.com`,
          name: "Sync",
          emailVerified: true,
          image: null,
        })
        .execute();
    }
    const tournament = await repos.tournaments.create({
      hostType: "user",
      hostUserId: HOST_ID,
      name: "Sync Cup",
      startsAt: new Date(Date.now() + 86_400_000),
      pairingStyle: "none",
      deckSubmission: "required",
    });
    tournamentId = tournament.id;
    const without = await repos.tournaments.create({
      hostType: "user",
      hostUserId: HOST_ID,
      name: "No Decks Cup",
      startsAt: new Date(Date.now() + 86_400_000),
      pairingStyle: "swiss",
      deckSubmission: "none",
    });
    deckless = without.id;
  });

  afterAll(async () => {
    await db.deleteFrom("tournaments").where("id", "in", [tournamentId, deckless]).execute();
    await db.deleteFrom("users").where("id", "in", [HOST_ID, STRANGER_ID]).execute();
  });

  it("offers the host's tournaments and none linked before the first sync", async () => {
    const res = await hostApp.fetch(req("GET", `/tournaments/playriftbound/${EVENT_ID}/targets`));
    expect(res.status).toBe(200);
    const body = (await readJson(res)) as { items: { id: string }[]; linkedIds: string[] };
    expect(body.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([tournamentId, deckless]),
    );
    expect(body.linkedIds).toEqual([]);
  });

  it("links the event, seats the roster and files submitted decks without sharing consent", async () => {
    const res = await sync([registrant("p1"), registrant("p2", { deck: null })]);
    expect(res.status).toBe(200);
    expect(await readJson(res)).toMatchObject({
      participantsCreated: 2,
      decksCreated: 1,
      decksUnchanged: 0,
    });
    const tournament = await repos.tournaments.getById(tournamentId);
    expect(tournament?.playriftboundEventId).toBe(EVENT_ID);
    const entry = await entryOf("p1");
    expect(entry).toMatchObject({
      allowDeckPublishing: false,
      allowNameSharing: false,
      allowRiotIdSharing: false,
      riotId: "Player p1#EUW",
    });
    expect(await entryOf("p2")).toBeUndefined();

    const targets = await hostApp.fetch(
      req("GET", `/tournaments/playriftbound/${EVENT_ID}/targets`),
    );
    expect(((await readJson(targets)) as { linkedIds: string[] }).linkedIds).toEqual([
      tournamentId,
    ]);
  });

  it("leaves a judge's repair and a resubmission on OpenRift alone while the source is unchanged", async () => {
    const entry = await entryOf("p1");
    await repos.deckCheck.updateEntry(entry!.id, {
      contentHash: "judge-edited",
      submittedAt: new Date(),
    });

    const res = await sync([registrant("p1"), registrant("p2", { deck: null })]);
    expect(await readJson(res)).toMatchObject({
      participantsCreated: 0,
      decksCreated: 0,
      decksUpdated: 0,
      decksUnchanged: 1,
    });
    expect(await entryOf("p1")).toMatchObject({ contentHash: "judge-edited" });
  });

  it("keeps a list a judge withdrew while the source is unchanged", async () => {
    const entry = await entryOf("p1");
    await repos.deckCheck.updateEntry(entry!.id, { state: "withdrawn", withdrawnAt: new Date() });
    await sync([registrant("p1"), registrant("p2", { deck: null })]);
    expect(await entryOf("p1")).toMatchObject({ state: "withdrawn" });
  });

  it("replaces a list the player saved again", async () => {
    const res = await sync([
      registrant("p1", {
        deck: { deckText: "MainDeck:\n2 Defy", lastSavedAt: "2026-11-18T09:00:00Z" },
      }),
      registrant("p2", { deck: null }),
    ]);
    expect(await readJson(res)).toMatchObject({ decksUpdated: 1 });
    const replaced = await entryOf("p1");
    expect(replaced?.contentHash).not.toBe("judge-edited");
    expect(replaced?.state).toBe("submitted");
  });

  it("files the deck of a player who submitted late onto the seated participant", async () => {
    const res = await sync([
      registrant("p1", {
        deck: { deckText: "MainDeck:\n2 Defy", lastSavedAt: "2026-11-18T09:00:00Z" },
      }),
      registrant("p2"),
    ]);
    expect(await readJson(res)).toMatchObject({ participantsCreated: 0, decksCreated: 1 });
    const participants = await repos.tournaments.listParticipants(tournamentId);
    expect(participants).toHaveLength(2);
  });

  it("keeps a list entered on OpenRift for a seated player", async () => {
    await sync([registrant("p1"), registrant("p2"), registrant("p3", { deck: null })]);
    const seated = await repos.tournaments.getParticipantByExternalId(
      tournamentId,
      "playriftbound:p3",
    );
    await repos.deckCheck.createEntry({
      tournamentId,
      participantId: seated!.id,
      externalId: "manual:p3-at-the-table",
      submittedAt: new Date(),
      contentHash: "entered-by-judge",
      withdrawnAt: null,
      state: "submitted",
    });

    const res = await sync([registrant("p1"), registrant("p2"), registrant("p3")]);
    expect(await readJson(res)).toMatchObject({ decksCreated: 0, decksKept: 1 });
    expect(await entryOf("p3")).toBeUndefined();
  });

  it("drops a player who left the event and keeps their list", async () => {
    const res = await sync([registrant("p1"), registrant("p2")]);
    expect(await readJson(res)).toMatchObject({ participantsLeft: 1 });
    const left = await repos.tournaments.getParticipantByExternalId(
      tournamentId,
      "playriftbound:p3",
    );
    expect(left?.status).toBe("dropped");
    expect(
      await repos.deckCheck.getEntryByExternalId(tournamentId, "manual:p3-at-the-table"),
    ).toBeDefined();
  });

  it("drops a player the source dropped, and a drop stands when the source lists them again", async () => {
    await sync([registrant("p1", { dropped: true }), registrant("p2")]);
    const dropped = await repos.tournaments.getParticipantByExternalId(
      tournamentId,
      "playriftbound:p1",
    );
    expect(dropped?.status).toBe("dropped");
    await sync([registrant("p1"), registrant("p2")]);
    const still = await repos.tournaments.getParticipantByExternalId(
      tournamentId,
      "playriftbound:p1",
    );
    expect(still?.status).toBe("dropped");
  });

  it("keeps a claimed player's name when their list is replaced", async () => {
    const participant = await repos.tournaments.getParticipantByExternalId(
      tournamentId,
      "playriftbound:p2",
    );
    await repos.tournaments.updateParticipant(participant!.id, {
      userId: STRANGER_ID,
      displayName: "Chosen Name",
      riotId: "Chosen Name#EUW",
    });

    const res = await sync([
      registrant("p1"),
      registrant("p2", {
        deck: { deckText: "MainDeck:\n1 Defy", lastSavedAt: "2026-11-19T09:00:00Z" },
      }),
    ]);
    expect(await readJson(res)).toMatchObject({ decksUpdated: 1 });
    const claimed = await repos.tournaments.getParticipantByExternalId(
      tournamentId,
      "playriftbound:p2",
    );
    expect(claimed).toMatchObject({ displayName: "Chosen Name", riotId: "Chosen Name#EUW" });
  });

  it("does not bring back a list a judge deleted while the source is unchanged", async () => {
    const entry = await entryOf("p2");
    await repos.deckCheck.deleteEntry(tournamentId, entry!.id);

    const res = await sync([
      registrant("p1"),
      registrant("p2", {
        deck: { deckText: "MainDeck:\n1 Defy", lastSavedAt: "2026-11-19T09:00:00Z" },
      }),
    ]);
    expect(await readJson(res)).toMatchObject({ decksCreated: 0 });
    expect(await entryOf("p2")).toBeUndefined();
  });

  it("leaves a closed account nameless", async () => {
    const participant = await repos.tournaments.getParticipantByExternalId(
      tournamentId,
      "playriftbound:p2",
    );
    await db
      .updateTable("tournamentParticipants")
      .set({ isAccountClosed: true, displayName: null, riotId: null, userId: null })
      .where("id", "=", participant!.id)
      .execute();

    const res = await sync([registrant("p1"), registrant("p2")]);
    expect(res.status).toBe(200);
    const closed = await repos.tournaments.getParticipantByExternalId(
      tournamentId,
      "playriftbound:p2",
    );
    expect(closed).toMatchObject({ displayName: null, riotId: null });
  });

  it("refuses a second event, a tournament without deck submission and a non-organizer", async () => {
    await expect(sync([registrant("p1")], "117000000000000001")).resolves.toHaveProperty(
      "status",
      409,
    );
    await expect(sync([registrant("p1")], EVENT_ID, deckless)).resolves.toHaveProperty(
      "status",
      409,
    );
    const stranger = await strangerApp.fetch(
      req("POST", "/tournaments/playriftbound/sync", {
        tournamentId,
        payload: payload([registrant("p1")]),
      }),
    );
    expect(stranger.status).toBe(403);
  });

  it("keeps the event link while synced players are in the tournament", async () => {
    const res = await hostApp.fetch(
      req("PATCH", `/tournaments/${tournamentId}`, { playriftboundEventId: "117000000000000001" }),
    );
    expect(res.status).toBe(409);
  });

  it("refuses a completed tournament", async () => {
    await db
      .updateTable("tournaments")
      .set({ status: "completed" })
      .where("id", "=", tournamentId)
      .execute();
    await expect(sync([registrant("p1")])).resolves.toHaveProperty("status", 409);
  });
});
