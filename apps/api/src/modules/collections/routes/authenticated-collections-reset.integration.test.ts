import type { ResetCollectionsResponse } from "@openrift/shared/types/api/collection";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRepos, createTransact } from "../../../deps.js";
import { CARD_FURY_UNIT, PRINTING_1, PRINTING_2 } from "../../../test/fixtures/constants.js";
import { createTestContext, req, seedTestUser } from "../../../test/integration-context.js";
import { readJson } from "../../../test/read-json.js";
import { friendGroupsRepo } from "../../groups/repositories/friend-groups.js";
import { createTrade } from "../../groups/services/card-trades.js";

// Uses a throwaway random-UUID user, not a fixed registry one: reset wipes all of that user's collections.
const USER_ID = crypto.randomUUID();

const ctx = createTestContext(USER_ID);

afterAll(async () => {
  if (!ctx) {
    return;
  }
  await ctx.db.deleteFrom("lists").where("userId", "=", USER_ID).execute();
  await ctx.db
    .deleteFrom("copies")
    .where("collectionId", "in", (eb) =>
      eb.selectFrom("collections").select("id").where("userId", "=", USER_ID),
    )
    .execute();
  await ctx.db.deleteFrom("collections").where("userId", "=", USER_ID).execute();
  // Cascades the user's collection_events rows.
  await ctx.db.deleteFrom("users").where("id", "=", USER_ID).execute();
});

describe.skipIf(!ctx)("POST /collections/reset (integration)", () => {
  const { app, db } = ctx!;

  let inboxId: string;
  let wishListId: string;
  let copyListId: string;
  let ruledListId: string;
  let untouchedListId: string;

  async function createList(
    name: string,
    intent: "wish" | "trade" | "organize",
    kind: "card" | "printing" | "copy",
  ): Promise<string> {
    const res = await app.fetch(req("POST", "/lists", { name, intent, kind }));
    expect(res.status).toBe(201);
    const json = (await readJson(res)) as { id: string };
    return json.id;
  }

  beforeAll(async () => {
    await seedTestUser(db, { id: USER_ID });

    const inbox = await db
      .insertInto("collections")
      .values({ userId: USER_ID, groupId: null, name: "Inbox", isInbox: true, sortOrder: 0 })
      .returningAll()
      .executeTakeFirstOrThrow();
    inboxId = inbox.id;
    const binder = await db
      .insertInto("collections")
      .values({ userId: USER_ID, groupId: null, name: "Binder", isInbox: false, sortOrder: 1 })
      .returningAll()
      .executeTakeFirstOrThrow();

    const copies = await db
      .insertInto("copies")
      .values([
        { collectionId: inbox.id, printingId: PRINTING_1.id },
        { collectionId: binder.id, printingId: PRINTING_1.id },
        { collectionId: binder.id, printingId: PRINTING_2.id },
      ])
      .returningAll()
      .execute();

    wishListId = await createList("Reset wish", "wish", "card");
    const wishEntry = await app.fetch(
      req("POST", `/lists/${wishListId}/entries`, { cardId: CARD_FURY_UNIT.id }),
    );
    expect(wishEntry.status).toBe(201);

    copyListId = await createList("Reset trade", "trade", "copy");
    for (const copy of copies.slice(0, 2)) {
      const entry = await app.fetch(
        req("POST", `/lists/${copyListId}/entries`, { copyId: copy.id }),
      );
      expect(entry.status).toBe(201);
    }

    ruledListId = await createList("Reset ruled trade", "trade", "copy");
    const ruledEntry = await app.fetch(
      req("POST", `/lists/${ruledListId}/entries`, { copyId: copies[2]!.id }),
    );
    expect(ruledEntry.status).toBe(201);
    await db
      .updateTable("lists")
      .set({
        rules: sql`'[{"kind":"trade","collectionIds":null,"keepPerCard":{"mode":"fixed","n":1},"excludeCopyIds":[]}]'::jsonb`,
      })
      .where("id", "=", ruledListId)
      .execute();

    untouchedListId = await createList("Reset untouched", "wish", "card");
  });

  it("wipes copies, keeps only the inbox, and prunes only wipe-emptied ruleless lists", async () => {
    const res = await app.fetch(req("POST", "/collections/reset"));
    expect(res.status).toBe(200);

    const json = (await readJson(res)) as ResetCollectionsResponse;
    expect(json.removedCopies).toBe(3);
    expect(json.removedCollections).toBe(1);
    expect(json.removedLists).toBe(1);

    const collections = await db
      .selectFrom("collections")
      .select(["id", "isInbox"])
      .where("userId", "=", USER_ID)
      .execute();
    expect(collections).toHaveLength(1);
    expect(collections[0]!.id).toBe(inboxId);
    expect(collections[0]!.isInbox).toBe(true);

    const copies = await db
      .selectFrom("copies")
      .select("id")
      .where("collectionId", "=", inboxId)
      .execute();
    expect(copies).toHaveLength(0);

    const listRows = await db
      .selectFrom("lists")
      .select("id")
      .where("userId", "=", USER_ID)
      .execute();
    const listIds = listRows.map((row) => row.id);
    expect(listIds).not.toContain(copyListId);
    expect(listIds).toContain(wishListId);
    expect(listIds).toContain(ruledListId);
    expect(listIds).toContain(untouchedListId);

    const events = await db
      .selectFrom("collectionEvents")
      .select(["action"])
      .where("userId", "=", USER_ID)
      .execute();
    expect(events.filter((event) => event.action === "removed")).toHaveLength(3);
  });

  it("is idempotent and recreates a missing inbox", async () => {
    // The previous test left only the (now empty) inbox — delete it to
    // simulate a user without one.
    await db.deleteFrom("collections").where("id", "=", inboxId).execute();

    const res = await app.fetch(req("POST", "/collections/reset"));
    expect(res.status).toBe(200);

    const json = (await readJson(res)) as ResetCollectionsResponse;
    expect(json.removedCopies).toBe(0);
    expect(json.removedCollections).toBe(0);
    expect(json.removedLists).toBe(0);

    const collections = await db
      .selectFrom("collections")
      .select("isInbox")
      .where("userId", "=", USER_ID)
      .execute();
    expect(collections).toHaveLength(1);
    expect(collections[0]!.isInbox).toBe(true);
  });
});

const GIVER_ID = crypto.randomUUID();
const RECEIVER_ID = crypto.randomUUID();
const giverCtx = createTestContext(GIVER_ID);

describe.skipIf(!giverCtx)("POST /collections/reset with a pending trade (integration)", () => {
  const { app, db } = giverCtx!;
  const repos = createRepos(db);
  const transact = createTransact(db);
  let groupId: string;
  let copyId: string;
  let tradeId: string;

  beforeAll(async () => {
    await seedTestUser(db, { id: GIVER_ID });
    await seedTestUser(db, { id: RECEIVER_ID });

    const groups = friendGroupsRepo(db);
    const slug = `reset-${Date.now().toString(36)}`;
    const group = await groups.createWithOwner(
      { slug, name: "Reset Trade Group", description: null, code: null },
      GIVER_ID,
    );
    groupId = group.id;
    await groups.addMember(group.id, RECEIVER_ID, "member");

    const wish = await db
      .insertInto("lists")
      .values({ userId: RECEIVER_ID, name: "Wants", intent: "wish", kind: "printing" })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db
      .insertInto("listEntries")
      .values({
        listId: wish.id,
        userId: RECEIVER_ID,
        kind: "printing",
        printingId: PRINTING_1.id,
        quantity: 1,
      })
      .execute();
    await groups.share(group.id, wish.id, RECEIVER_ID);

    const binder = await db
      .insertInto("collections")
      .values({ userId: GIVER_ID, name: "Binder", isInbox: false, sortOrder: 1 })
      .returning("id")
      .executeTakeFirstOrThrow();
    const copy = await db
      .insertInto("copies")
      .values({ printingId: PRINTING_1.id, collectionId: binder.id })
      .returning("id")
      .executeTakeFirstOrThrow();
    copyId = copy.id;
    const haves = await db
      .insertInto("lists")
      .values({ userId: GIVER_ID, name: "Haves", intent: "trade", kind: "copy" })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db
      .insertInto("listEntries")
      .values({ listId: haves.id, userId: GIVER_ID, kind: "copy", copyId, quantity: 1 })
      .execute();
    await groups.share(group.id, haves.id, GIVER_ID);

    const trade = await createTrade(
      { repos, transact },
      {
        callerUserId: RECEIVER_ID,
        groupSlug: slug,
        counterpartyUserId: GIVER_ID,
        role: "receiver",
        printingId: PRINTING_1.id,
        quantity: 1,
      },
    );
    tradeId = trade.id;
  });

  afterAll(async () => {
    const userIds = [GIVER_ID, RECEIVER_ID];
    await db
      .deleteFrom("cardTrades")
      .where((eb) => eb.or([eb("giverUserId", "in", userIds), eb("receiverUserId", "in", userIds)]))
      .execute();
    await db.deleteFrom("friendGroups").where("id", "=", groupId).execute();
    await db.deleteFrom("lists").where("userId", "in", userIds).execute();
    await db
      .deleteFrom("copies")
      .where("collectionId", "in", (eb) =>
        eb.selectFrom("collections").select("id").where("userId", "in", userIds),
      )
      .execute();
    await db.deleteFrom("collections").where("userId", "in", userIds).execute();
    await db.deleteFrom("users").where("id", "in", userIds).execute();
  });

  async function tradeStatus(): Promise<string | undefined> {
    const row = await repos.cardTrades.getById(tradeId);
    return row?.status;
  }

  async function copyStillThere(): Promise<boolean> {
    const row = await db
      .selectFrom("copies")
      .select("id")
      .where("id", "=", copyId)
      .executeTakeFirst();
    return row !== undefined;
  }

  it("lists the trade in the check and leaves copy and trade in place", async () => {
    const res = await app.fetch(req("POST", "/collections/trade-cancels/reset"));
    expect(res.status).toBe(200);

    const json = (await readJson(res)) as { trades: { id: string }[] };
    expect(json.trades.map((trade) => trade.id)).toEqual([tradeId]);
    expect(await tradeStatus()).toBe("pending");
    expect(await copyStillThere()).toBe(true);
  });

  it("refuses an unconfirmed reset with the trade it would cancel and resets nothing", async () => {
    const res = await app.fetch(req("POST", "/collections/reset"));
    expect(res.status).toBe(409);

    const json = (await readJson(res)) as { defined: boolean; data: { trades: { id: string }[] } };
    expect(json.defined).toBe(true);
    expect(json.data.trades.map((trade) => trade.id)).toEqual([tradeId]);
    expect(await tradeStatus()).toBe("pending");
    expect(await copyStillThere()).toBe(true);
  });

  it("resets and cancels the trade once the request confirms it", async () => {
    const res = await app.fetch(req("POST", "/collections/reset", { cancelTradeIds: [tradeId] }));
    expect(res.status).toBe(200);

    expect(await tradeStatus()).toBe("cancelled");
    expect(await copyStillThere()).toBe(false);
  });
});
