import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbContext, seedTestUser } from "../../../test/integration-context.js";
import { friendGroupCalendarFeedsRepo } from "./friend-group-calendar-feeds.js";
import { friendGroupsRepo } from "./friend-groups.js";

const OWNER_ID = crypto.randomUUID();
const MEMBER_ID = crypto.randomUUID();

const ctx = createDbContext(OWNER_ID);

describe.skipIf(!ctx)("friendGroupCalendarFeedsRepo (integration)", () => {
  const { db } = ctx!;
  const repo = friendGroupCalendarFeedsRepo(db);
  const groups = friendGroupsRepo(db);

  const createdGroupIds: string[] = [];

  beforeAll(async () => {
    await seedTestUser(db, { id: OWNER_ID });
    await seedTestUser(db, { id: MEMBER_ID });
  });

  afterAll(async () => {
    if (createdGroupIds.length > 0) {
      await db.deleteFrom("friendGroups").where("id", "in", createdGroupIds).execute();
    }
    await db.deleteFrom("users").where("id", "in", [OWNER_ID, MEMBER_ID]).execute();
  });

  function uniqueSlug(): string {
    return `fgcf-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  }

  async function createGroup() {
    const group = await groups.createWithOwner(
      { slug: uniqueSlug(), name: "Hexgate Playgroup", description: null, code: null },
      OWNER_ID,
    );
    createdGroupIds.push(group.id);
    return group;
  }

  it("keeps the first token when a feed is enabled twice", async () => {
    const group = await createGroup();

    const first = await repo.enable({
      groupId: group.id,
      userId: OWNER_ID,
      kind: "tournaments",
      token: `first-${group.id}`,
    });
    const second = await repo.enable({
      groupId: group.id,
      userId: OWNER_ID,
      kind: "tournaments",
      token: `second-${group.id}`,
    });

    expect(first).toEqual({ kind: "tournaments", token: `first-${group.id}` });
    expect(second).toEqual(first);
  });

  it("keeps the tournaments and shop events feeds apart", async () => {
    const group = await createGroup();
    await repo.enable({
      groupId: group.id,
      userId: OWNER_ID,
      kind: "tournaments",
      token: `tournaments-${group.id}`,
    });
    await repo.enable({
      groupId: group.id,
      userId: OWNER_ID,
      kind: "shop_events",
      token: `shops-${group.id}`,
    });

    expect(await repo.listForMember(group.id, OWNER_ID)).toEqual([
      { kind: "shop_events", token: `shops-${group.id}` },
      { kind: "tournaments", token: `tournaments-${group.id}` },
    ]);

    await repo.disable(group.id, OWNER_ID, "shop_events");

    expect(await repo.listForMember(group.id, OWNER_ID)).toEqual([
      { kind: "tournaments", token: `tournaments-${group.id}` },
    ]);
    expect(await repo.findByToken(`shops-${group.id}`)).toBeUndefined();
  });

  it("resolves a token to its group and feed kind", async () => {
    const group = await createGroup();
    await repo.enable({
      groupId: group.id,
      userId: OWNER_ID,
      kind: "shop_events",
      token: `lookup-${group.id}`,
    });

    expect(await repo.findByToken(`lookup-${group.id}`)).toEqual({
      groupId: group.id,
      groupName: "Hexgate Playgroup",
      kind: "shop_events",
    });
  });

  it("deletes a member's feeds when they leave the group", async () => {
    const group = await createGroup();
    await groups.addMember(group.id, MEMBER_ID, "member");
    await repo.enable({
      groupId: group.id,
      userId: MEMBER_ID,
      kind: "tournaments",
      token: `leaver-${group.id}`,
    });

    await groups.removeMember(group.id, MEMBER_ID);

    expect(await repo.findByToken(`leaver-${group.id}`)).toBeUndefined();
  });

  it("refuses a feed for someone who is not a member", async () => {
    const group = await createGroup();

    await expect(
      repo.enable({
        groupId: group.id,
        userId: MEMBER_ID,
        kind: "tournaments",
        token: `outsider-${group.id}`,
      }),
    ).rejects.toThrow();
  });
});
