import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MAX_BIND_PARAMETERS } from "../../../lib/bind-batches.js";
import { createDbContext, seedTestUser } from "../../../test/integration-context.js";
import { metaOverlaysRepo } from "./meta-overlays.js";

const ctx = createDbContext(crypto.randomUUID());

describe.skipIf(!ctx)("metaOverlaysRepo key batching (integration)", () => {
  const { db } = ctx!;
  const repo = metaOverlaysRepo(db);

  const overlong = Array.from({ length: MAX_BIND_PARAMETERS + 1 }, () => crypto.randomUUID());

  it("reads cards for more overlay ids than one statement can bind", async () => {
    await expect(repo.cardsByOverlayIds(overlong)).resolves.toEqual(new Map());
  });

  it("reads player overlays for more source keys than one statement can bind", async () => {
    await expect(repo.playerOverlaysBySourceKeys("topdeck", overlong)).resolves.toEqual([]);
  });

  it("reads event overlays for more external ids than one statement can bind", async () => {
    await expect(repo.eventOverlaysBySourceKeys("topdeck", overlong)).resolves.toEqual([]);
  });

  it("sets statuses for more overlay ids than one statement can bind", async () => {
    await expect(repo.setPlayerOverlayStatuses(overlong, "rejected", new Date())).resolves.toBe(0);
  });
});

describe.skipIf(!ctx)("metaOverlaysRepo admin edit lookups (integration)", () => {
  const { db } = ctx!;
  const repo = metaOverlaysRepo(db);
  let userId = "";
  let eventId = "";
  let playerId = "";

  beforeAll(async () => {
    ({ id: userId } = await seedTestUser(db));
    const event = await db
      .insertInto("metaEvents")
      .values({
        slug: `moi-${crypto.randomUUID().slice(0, 8)}`,
        name: "Summoner Skirmish Zaun",
        eventDate: "2026-08-15",
        format: "freeform",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    eventId = event.id;
    const player = await db
      .insertInto("metaEventPlayers")
      .values({ metaEventId: eventId, rank: 1, playerName: "Zaun Zed" })
      .returning("id")
      .executeTakeFirstOrThrow();
    playerId = player.id;
  });

  afterAll(async () => {
    await db.deleteFrom("metaEvents").where("id", "=", eventId).execute();
    await db.deleteFrom("users").where("id", "=", userId).execute();
  });

  function acceptedEventOverlay(origin: "admin_edit" | "contributor") {
    return db
      .insertInto("metaEventOverlays")
      .values({
        metaEventId: eventId,
        playerCount: 48,
        claimedFields: ["playerCount"],
        status: "accepted",
        acceptedAt: new Date(),
        submittedByUserId: userId,
        origin,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
  }

  function acceptedPlayerOverlay(origin: "admin_edit" | "contributor") {
    return db
      .insertInto("metaEventPlayerOverlays")
      .values({
        metaEventPlayerId: playerId,
        wins: 5,
        claimedFields: ["wins"],
        status: "accepted",
        acceptedAt: new Date(),
        submittedByUserId: userId,
        origin,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
  }

  it("finds an admin's event edit by its origin alone", async () => {
    const contributed = await acceptedEventOverlay("contributor");
    const edited = await acceptedEventOverlay("admin_edit");

    const found = await repo.adminEditOverlay(eventId, userId);
    expect(found?.id).toBe(edited.id);
    expect(await repo.adminEditEventOverlayIds([contributed.id, edited.id])).toEqual(
      new Set([edited.id]),
    );
  });

  it("finds an admin's standings edit by its origin alone", async () => {
    const contributed = await acceptedPlayerOverlay("contributor");
    const edited = await acceptedPlayerOverlay("admin_edit");

    const found = await repo.adminPlayerEditOverlay(playerId, userId);
    expect(found?.id).toBe(edited.id);
    expect(await repo.adminEditPlayerOverlayIds([contributed.id, edited.id])).toEqual(
      new Set([edited.id]),
    );
  });
});
