import { sql } from "kysely";
import type { Transaction } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../../../db/tables.js";
import { createRepos, createTransact } from "../../../deps.js";
import { PRINTING_1 } from "../../../test/fixtures/constants.js";
import { createDbContext, seedTestUser } from "../../../test/integration-context.js";
import { friendGroupsRepo } from "../repositories/friend-groups.js";
import { acceptTrade, cancelTrade, createTrade } from "./card-trades.js";

const GIVER_ID = crypto.randomUUID();
const RECEIVER_ID = crypto.randomUUID();
const ALL_USER_IDS = [GIVER_ID, RECEIVER_ID];

const ctx = createDbContext(GIVER_ID);

describe.skipIf(!ctx)(
  "card trade transitions vs a concurrent trade row write (integration)",
  () => {
    const { db } = ctx!;
    const repos = createRepos(db);
    const transact = createTransact(db);
    const groupsRepo = friendGroupsRepo(db);

    const createdGroupIds: string[] = [];

    beforeAll(async () => {
      for (const id of ALL_USER_IDS) {
        await seedTestUser(db, { id });
      }
    });

    afterAll(async () => {
      await db
        .deleteFrom("cardTrades")
        .where((eb) =>
          eb.or([eb("giverUserId", "in", ALL_USER_IDS), eb("receiverUserId", "in", ALL_USER_IDS)]),
        )
        .execute();
      if (createdGroupIds.length > 0) {
        await db.deleteFrom("friendGroups").where("id", "in", createdGroupIds).execute();
      }
      await db.deleteFrom("lists").where("userId", "in", ALL_USER_IDS).execute();
      await db
        .deleteFrom("copies")
        .where(
          "collectionId",
          "in",
          db.selectFrom("collections").select("id").where("userId", "in", ALL_USER_IDS),
        )
        .execute();
      await db.deleteFrom("collections").where("userId", "in", ALL_USER_IDS).execute();
      await db.deleteFrom("users").where("id", "in", ALL_USER_IDS).execute();
    });

    async function seedPendingTrade(copyCount: number): Promise<string> {
      const slug = `lock-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
      const group = await groupsRepo.createWithOwner(
        { slug, name: "Lock Race Group", description: null, code: null },
        GIVER_ID,
      );
      createdGroupIds.push(group.id);
      await groupsRepo.addMember(group.id, RECEIVER_ID, "member");

      const wish = await db
        .insertInto("lists")
        .values({ userId: RECEIVER_ID, name: `Wants ${slug}`, intent: "wish", kind: "printing" })
        .returning("id")
        .executeTakeFirstOrThrow();
      await db
        .insertInto("listEntries")
        .values({
          listId: wish.id,
          userId: RECEIVER_ID,
          kind: "printing",
          printingId: PRINTING_1.id,
          quantity: copyCount,
        })
        .execute();
      await groupsRepo.share(group.id, wish.id, RECEIVER_ID);

      const collection = await db
        .insertInto("collections")
        .values({ userId: GIVER_ID, name: `Binder ${slug}`, isInbox: false, sortOrder: 1 })
        .returning("id")
        .executeTakeFirstOrThrow();
      const tradeList = await db
        .insertInto("lists")
        .values({ userId: GIVER_ID, name: `Haves ${slug}`, intent: "trade", kind: "copy" })
        .returning("id")
        .executeTakeFirstOrThrow();
      for (let index = 0; index < copyCount; index++) {
        const copy = await db
          .insertInto("copies")
          .values({ printingId: PRINTING_1.id, collectionId: collection.id })
          .returning("id")
          .executeTakeFirstOrThrow();
        await db
          .insertInto("listEntries")
          .values({
            listId: tradeList.id,
            userId: GIVER_ID,
            kind: "copy",
            copyId: copy.id,
            quantity: 1,
          })
          .execute();
      }
      await groupsRepo.share(group.id, tradeList.id, GIVER_ID);

      const trade = await createTrade(
        { repos, transact },
        {
          callerUserId: RECEIVER_ID,
          groupSlug: group.slug,
          counterpartyUserId: GIVER_ID,
          role: "receiver",
          printingId: PRINTING_1.id,
          quantity: 1,
        },
      );
      return trade.id;
    }

    async function raceAgainstRowWrite<T>(
      tradeId: string,
      run: () => Promise<T>,
      write: (trx: Transaction<Database>) => Promise<void>,
    ): Promise<PromiseSettledResult<T>> {
      let result: Promise<PromiseSettledResult<T>> | undefined;
      await db.transaction().execute(async (trx) => {
        await trx
          .selectFrom("cardTrades")
          .select("id")
          .where("id", "=", tradeId)
          .forUpdate()
          .execute();
        result = run().then(
          (value) => ({ status: "fulfilled", value }) as const,
          (error: unknown) => ({ status: "rejected", reason: error }) as const,
        );
        await waitForTradeLockWait();
        await write(trx);
      });
      if (!result) {
        throw new Error("The raced transition never started");
      }
      return result;
    }

    async function waitForTradeLockWait(): Promise<void> {
      for (let attempt = 0; attempt < 200; attempt++) {
        const { rows } = await sql<{ waiting: number }>`
        select count(*)::int as waiting from pg_stat_activity
        where wait_event_type = 'Lock' and query ilike '%card_trade%'`.execute(db);
        if ((rows[0]?.waiting ?? 0) > 0) {
          return;
        }
        await Bun.sleep(10);
      }
      throw new Error("No trade write ever waited on the trade row lock");
    }

    it("refuses a cancel once the giver's settle commits underneath it", async () => {
      const tradeId = await seedPendingTrade(1);
      await acceptTrade(transact, tradeId, GIVER_ID);

      const cancel = await raceAgainstRowWrite(
        tradeId,
        () => cancelTrade(transact, tradeId, RECEIVER_ID),
        async (trx) => {
          await trx
            .updateTable("cardTrades")
            .set({ giverSyncAppliedAt: sql`now()` })
            .where("id", "=", tradeId)
            .execute();
        },
      );

      expect(cancel.status).toBe("rejected");
      expect((cancel as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
      const trade = await db
        .selectFrom("cardTrades")
        .select("status")
        .where("id", "=", tradeId)
        .executeTakeFirstOrThrow();
      expect(trade.status).toBe("reserved");
    });

    it("reserves as many copies as the quantity committed underneath an accept", async () => {
      const tradeId = await seedPendingTrade(2);

      const accept = await raceAgainstRowWrite(
        tradeId,
        () => acceptTrade(transact, tradeId, GIVER_ID),
        async (trx) => {
          await trx
            .updateTable("cardTrades")
            .set({ quantity: 2 })
            .where("id", "=", tradeId)
            .execute();
        },
      );

      expect(accept.status).toBe("fulfilled");
      const trade = await db
        .selectFrom("cardTrades")
        .select(["status", "quantity"])
        .where("id", "=", tradeId)
        .executeTakeFirstOrThrow();
      const pins = await db
        .selectFrom("cardTradeCopies")
        .select("copyId")
        .where("tradeId", "=", tradeId)
        .execute();
      expect(trade).toEqual({ status: "reserved", quantity: 2 });
      expect(pins).toHaveLength(2);
    });
  },
);
