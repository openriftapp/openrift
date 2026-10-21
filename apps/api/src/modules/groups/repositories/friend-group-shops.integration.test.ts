import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbContext, seedTestUser } from "../../../test/integration-context.js";
import { friendGroupShopsRepo } from "./friend-group-shops.js";
import { friendGroupsRepo } from "./friend-groups.js";

const OWNER_ID = crypto.randomUUID();
const ORGANIZER_ID = `fgs-${crypto.randomUUID()}`;
// The mirror has no provider column, so isolation is by key prefix.
const UPCOMING_ID = "990100000000000001";
const PAST_ID = "990100000000000002";
const FAR_ID = "990100000000000003";

const ctx = createDbContext(OWNER_ID);

describe.skipIf(!ctx)("friendGroupShopsRepo with playriftbound stores (integration)", () => {
  const { db } = ctx!;
  const repo = friendGroupShopsRepo(db);
  const groups = friendGroupsRepo(db);
  let groupId = "";

  const day = 24 * 60 * 60 * 1000;
  const inDays = (days: number) => new Date(Date.now() + days * day);

  beforeAll(async () => {
    await seedTestUser(db, { id: OWNER_ID });
    const group = await groups.createWithOwner(
      {
        slug: `fgs-${Date.now().toString(36)}`,
        name: "Hexgate Playgroup",
        description: null,
        code: null,
      },
      OWNER_ID,
    );
    groupId = group.id;
    await db
      .insertInto("playriftboundOrganizers")
      .values({
        id: ORGANIZER_ID,
        name: "FGS Bandle City Games",
        city: "Bandle City",
        adminArea: null,
        address: "1 Yordle Lane, Bandle City",
        latitude: 52.37,
        longitude: 9.73,
      })
      .execute();
    const event = (tournamentId: string, startAt: Date) => ({
      tournamentId,
      organizerId: ORGANIZER_ID,
      name: `FGS Nexus Night ${tournamentId}`,
      startAt,
      tournamentType: "NEXUS_NIGHT",
      format: "CONSTRUCTED",
      playerFormat: "ONE_V_ONE",
      participantCapacity: 16,
      registeredCount: 4,
      waitlistedCount: 0,
      pricing: "FREE",
      entryFeeCurrency: null,
      entryFeeMinor: null,
      contentHash: "hash",
      lastSeenAt: new Date(),
    });
    await db
      .insertInto("playriftboundEvents")
      .values([
        event(UPCOMING_ID, inDays(3)),
        event(PAST_ID, inDays(-5)),
        event(FAR_ID, inDays(40)),
      ])
      .execute();
  });

  afterAll(async () => {
    await db
      .deleteFrom("playriftboundEvents")
      .where("tournamentId", "in", [UPCOMING_ID, PAST_ID, FAR_ID])
      .execute();
    await db.deleteFrom("playriftboundOrganizers").where("id", "=", ORGANIZER_ID).execute();
    if (groupId !== "") {
      await db.deleteFrom("friendGroups").where("id", "=", groupId).execute();
    }
    await db.deleteFrom("users").where("id", "=", OWNER_ID).execute();
  });

  it("finds a store with something ahead of it by its city", async () => {
    const results = await repo.searchShops("Bandle City");
    expect(results).toContainEqual({
      source: "playriftbound",
      storeId: ORGANIZER_ID,
      name: "FGS Bandle City Games",
      location: "1 Yordle Lane, Bandle City",
      upcomingCount: 2,
    });
  });

  it("links, lists, counts and unlinks the store", async () => {
    expect(await repo.storeExists("playriftbound", ORGANIZER_ID)).toBe(true);
    await repo.linkShop({
      groupId,
      source: "playriftbound",
      storeId: ORGANIZER_ID,
      addedByUserId: OWNER_ID,
    });
    await repo.linkShop({
      groupId,
      source: "playriftbound",
      storeId: ORGANIZER_ID,
      addedByUserId: OWNER_ID,
    });

    expect(await repo.countShops(groupId)).toBe(1);
    const [shop] = await repo.listShops(groupId);
    expect(shop).toMatchObject({
      source: "playriftbound",
      storeId: ORGANIZER_ID,
      upcomingCount: 2,
    });

    const window = await repo.listEventsInWindow(groupId, 30, 14);
    expect(window.map((event) => event.externalId)).toEqual([PAST_ID, UPCOMING_ID]);
    expect(window[0]).toMatchObject({ source: "playriftbound", eventFormat: "CONSTRUCTED" });

    const feed = await repo.listFeedEvents(groupId, 30);
    expect(feed.map((event) => event.externalId)).toEqual([PAST_ID, UPCOMING_ID, FAR_ID]);

    expect(await repo.unlinkShop(groupId, "playriftbound", ORGANIZER_ID)).toBe(true);
    expect(await repo.countShops(groupId)).toBe(0);
  });
});
