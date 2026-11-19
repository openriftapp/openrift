import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbContext, seedTestUser } from "../../../test/integration-context.js";
import { friendGroupsRepo } from "../../groups/repositories/friend-groups.js";
import { collectionsRepo } from "./collections.js";
import { copiesRepo } from "./copies.js";

const ctx = createDbContext("a0000000-0091-4000-a000-000000000001");

describe.skipIf(!ctx)("copiesRepo.accessibleCollectionIds (integration)", () => {
  const { db } = ctx!;
  const copies = copiesRepo(db);
  const collections = collectionsRepo(db);
  const groups = friendGroupsRepo(db);

  const userIds: string[] = [];
  const collectionIds: string[] = [];
  const groupIds: string[] = [];
  let viewerId: string;
  let ownEmpty: string;
  let memberPool: string;
  let foreignPool: string;
  let othersCollection: string;

  function create(values: { userId: string | null; groupId: string | null; name: string }) {
    return collections.create({ ...values, description: null, isInbox: false, sortOrder: 0 });
  }

  beforeAll(async () => {
    const viewer = await seedTestUser(db);
    const other = await seedTestUser(db);
    viewerId = viewer.id;
    userIds.push(viewer.id, other.id);

    const stamp = Date.now().toString(36);
    const member = await groups.createWithOwner(
      { slug: `reach-member-${stamp}`, name: "Reach Member", description: null, code: null },
      viewer.id,
    );
    const foreign = await groups.createWithOwner(
      { slug: `reach-foreign-${stamp}`, name: "Reach Foreign", description: null, code: null },
      other.id,
    );
    groupIds.push(member.id, foreign.id);

    const created = await Promise.all([
      create({ userId: viewer.id, groupId: null, name: "Empty Inbox" }),
      create({ userId: null, groupId: member.id, name: "Member Pool" }),
      create({ userId: null, groupId: foreign.id, name: "Foreign Pool" }),
      create({ userId: other.id, groupId: null, name: "Other's" }),
    ]);
    [ownEmpty, memberPool, foreignPool, othersCollection] = created.map((row) => row.id) as [
      string,
      string,
      string,
      string,
    ];
    collectionIds.push(ownEmpty, memberPool, foreignPool, othersCollection);
  });

  afterAll(async () => {
    await db.deleteFrom("collections").where("id", "in", collectionIds).execute();
    await db.deleteFrom("friendGroups").where("id", "in", groupIds).execute();
    await db.deleteFrom("collections").where("userId", "in", userIds).execute();
    await db.deleteFrom("users").where("id", "in", userIds).execute();
  });

  it("names the viewer's own collections, empty ones included, and their groups' pools", async () => {
    const ids = await copies.accessibleCollectionIds(viewerId);

    expect(ids).toEqual(expect.arrayContaining([ownEmpty, memberPool]));
    expect(ids).not.toContain(foreignPool);
    expect(ids).not.toContain(othersCollection);
  });
});
