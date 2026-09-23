import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbContext, seedTestUser } from "../../../test/integration-context.js";
import { usersRepo } from "./users.js";

const ctx = createDbContext("a0000000-0201-4000-a000-000000000001");

describe.skipIf(!ctx)("usersRepo.listWithCounts (integration)", () => {
  const { db } = ctx!;
  const repo = usersRepo(db);
  let memberId = "";
  let loneId = "";
  const groupIds: string[] = [];

  beforeAll(async () => {
    const member = await seedTestUser(db);
    const lone = await seedTestUser(db);
    memberId = member.id;
    loneId = lone.id;
    const suffix = Date.now().toString(36);
    for (const name of ["Zaun Swap Meet", "Bandle Binder Club"]) {
      const group = await db
        .insertInto("friendGroups")
        .values({ slug: `users-list-${groupIds.length}-${suffix}`, name })
        .returning("id")
        .executeTakeFirstOrThrow();
      groupIds.push(group.id);
      await db
        .insertInto("friendGroupMembers")
        .values({ groupId: group.id, userId: memberId, role: "member" })
        .execute();
    }
  });

  afterAll(async () => {
    await db.deleteFrom("friendGroups").where("id", "in", groupIds).execute();
    await db.deleteFrom("users").where("id", "in", [memberId, loneId]).execute();
  });

  it("lists each user's groups sorted by name", async () => {
    const rows = await repo.listWithCounts();
    const member = rows.find((r) => r.id === memberId);
    const lone = rows.find((r) => r.id === loneId);
    expect(member?.groups).toEqual([
      { id: groupIds[1], name: "Bandle Binder Club" },
      { id: groupIds[0], name: "Zaun Swap Meet" },
    ]);
    expect(lone?.groups).toEqual([]);
  });
});
