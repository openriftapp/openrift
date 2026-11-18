import { describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { createRecordingDb } from "../../../test/recording-db.js";
import { friendGroupsRepo } from "./friend-groups.js";

const GROUP = {
  id: "grp-1",
  slug: "playgroup",
  name: "Tuesday Night Crew",
  description: null,
  code: "ABCDEFGHIJKL",
  codeRotatedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const INVITE = {
  id: "inv-1",
  groupId: "grp-1",
  userId: "u2",
  direction: "request" as const,
  createdAt: new Date(),
};

describe("friendGroupsRepo", () => {
  it.each([
    { numDeletedRows: 1n, expected: true },
    { numDeletedRows: 0n, expected: false },
  ])(
    "deleteById reports $expected when $numDeletedRows rows were deleted",
    async ({ numDeletedRows, expected }) => {
      await expect(
        friendGroupsRepo(createMockDb([{ numDeletedRows }])).deleteById("grp-1"),
      ).resolves.toBe(expected);
    },
  );

  it("listGroupsForUser coerces sub-select counts to numbers", async () => {
    const raw = {
      ...GROUP,
      viewerRole: "owner",
      memberCount: null,
      pendingRequestCount: 2n,
      sharedListCount: "3",
    };
    const repo = friendGroupsRepo(createMockDb([raw]));
    const [row] = await repo.listGroupsForUser("u-owner");
    expect(row?.memberCount).toBe(0);
    expect(row?.pendingRequestCount).toBe(2);
    expect(row?.sharedListCount).toBe(3);
    // The mock returns group-shaped rows for the preview query too; without a
    // matching groupId key the group falls back to an empty preview list.
    expect(row?.memberPreviews).toEqual([]);
  });

  it("getRevealedContactsForMembers groups revealed methods by userId", async () => {
    const repo = friendGroupsRepo(
      createMockDb([
        { userId: "u1", id: "m-1", type: "discord", value: "seb#1234" },
        { userId: "u1", id: "m-2", type: "email", value: "a@b.com" },
        { userId: "u2", id: "m-3", type: "phone", value: "+49" },
      ]),
    );
    const byUser = await repo.getRevealedContactsForMembers("grp-1");
    expect(byUser.get("u1")?.map((method) => method.id)).toEqual(["m-1", "m-2"]);
    expect(byUser.get("u2")?.map((method) => method.id)).toEqual(["m-3"]);
  });

  it("transferOwnership demotes then promotes in one transaction", async () => {
    const { db, events } = createRecordingDb([{ numAffectedRows: 1n }, [{ user_id: "u1" }]]);
    await expect(friendGroupsRepo(db).transferOwnership("grp-1", "u-owner", "u1")).resolves.toBe(
      true,
    );
    expect(events).toEqual(["begin", "commit"]);
  });

  it("transferOwnership reports a caller who no longer owns the group", async () => {
    const { db } = createRecordingDb([{ numAffectedRows: 0n }]);
    await expect(friendGroupsRepo(db).transferOwnership("grp-1", "u-owner", "u1")).resolves.toBe(
      false,
    );
  });

  it("transferOwnership rolls back when the target is not a member", async () => {
    const { db, events } = createRecordingDb([{ numAffectedRows: 1n }, []]);
    await expect(friendGroupsRepo(db).transferOwnership("grp-1", "u-owner", "u1")).rejects.toThrow(
      /is not a member/u,
    );
    expect(events).toEqual(["begin", "rollback"]);
  });

  it("listOwnRequestsForUser returns enriched rows without previews", async () => {
    const enriched = {
      ...INVITE,
      direction: "request" as const,
      groupName: "Tuesday Night Crew",
      groupSlug: "playgroup",
    };
    const repo = friendGroupsRepo(createMockDb([enriched]));
    expect(await repo.listOwnRequestsForUser("u2")).toEqual([{ ...enriched, memberCount: 0 }]);
  });

  it.each([
    { name: "returns the count", count: 2, expected: 2 },
    { name: "coerces a missing count to 0", count: null, expected: 0 },
  ])("pendingRequestsCountForUser $name", async ({ count, expected }) => {
    const repo = friendGroupsRepo(createMockDb([{ count }]));
    expect(await repo.pendingRequestsCountForUser("u-owner")).toBe(expected);
  });

  // ON CONFLICT DO NOTHING makes a repeat request indistinguishable from a
  // first one unless the affected-row count is read back.
  it.each([
    { numAffectedRows: 1n, expected: true },
    { numAffectedRows: 0n, expected: false },
  ])(
    "createInvite reports $expected when $numAffectedRows rows were inserted",
    async ({ numAffectedRows, expected }) => {
      const { db } = createRecordingDb([{ numAffectedRows }]);
      expect(await friendGroupsRepo(db).createInvite("grp-1", "u2", "request")).toBe(expected);
    },
  );
});
