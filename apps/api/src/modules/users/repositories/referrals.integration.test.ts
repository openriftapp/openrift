import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbContext, seedTestUser } from "../../../test/integration-context.js";
import { referralsRepo } from "./referrals.js";

const ctx = createDbContext("a0000000-0351-4000-a000-000000000001");

describe.skipIf(!ctx)("referralsRepo (integration)", () => {
  const { db } = ctx!;
  const repo = referralsRepo(db);
  const userIds: string[] = [];
  let referrerId = "";
  let code = "";

  async function seedUser(opts?: { emailVerified?: boolean }): Promise<string> {
    const user = await seedTestUser(db, opts);
    userIds.push(user.id);
    return user.id;
  }

  beforeAll(async () => {
    referrerId = await seedUser();
    code = `Ref${Date.now().toString(36)}`.padEnd(12, "x").slice(0, 12);
    const stored = await repo.setCodeIfMissing(referrerId, code);
    expect(stored).toBe(code);
  });

  afterAll(async () => {
    await db.deleteFrom("decks").where("userId", "in", userIds).execute();
    await db.deleteFrom("users").where("id", "in", userIds.toReversed()).execute();
  });

  it("keeps the first code on a second write", async () => {
    expect(await repo.setCodeIfMissing(referrerId, "Other0000000")).toBe(code);
  });

  it("records a referral for a fresh account once", async () => {
    const newcomer = await seedUser();
    expect(await repo.claim(newcomer, code)).toBe(true);
    expect(await repo.claim(newcomer, code)).toBe(false);
  });

  it("refuses an unknown code", async () => {
    const newcomer = await seedUser();
    expect(await repo.claim(newcomer, "Unknown00000")).toBe(false);
  });

  it("refuses a self-referral", async () => {
    expect(await repo.claim(referrerId, code)).toBe(false);
  });

  it("refuses an account older than the claim window", async () => {
    const veteran = await seedUser();
    await db
      .updateTable("users")
      .set({ createdAt: sql<Date>`now() - interval '2 days'` })
      .where("id", "=", veteran)
      .execute();
    expect(await repo.claim(veteran, code)).toBe(false);
  });

  it("counts only verified referrals with a deck or card", async () => {
    const before = await repo.counts(referrerId);
    const active = await seedUser();
    const idle = await seedUser();
    const unverified = await seedUser({ emailVerified: false });
    for (const id of [active, idle, unverified]) {
      expect(await repo.claim(id, code)).toBe(true);
    }
    await db
      .insertInto("decks")
      .values([
        { userId: active, name: "Jinx aggro", format: "constructed" },
        { userId: unverified, name: "Draven burn", format: "constructed" },
      ] as never)
      .execute();

    const after = await repo.counts(referrerId);
    expect(after.signedUp - before.signedUp).toBe(3);
    expect(after.counted - before.counted).toBe(1);
  });
});
