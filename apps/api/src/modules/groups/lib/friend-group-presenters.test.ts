import { describe, expect, it } from "vitest";

import { gravatarHashForEmail } from "../../../lib/gravatar.js";
import type {
  Group,
  MemberPreviewRow,
  MemberWithUser,
} from "../repositories/friend-groups-shared.js";
import type {
  CollectionCoverRow,
  CollectionShareRow,
  PendingRequestRow,
  ShareRow,
} from "./friend-group-presenters.js";
import {
  canSeeCode,
  groupCovers,
  toAdminGroupBanner,
  toCollectionShare,
  toDiscordLink,
  toGroup,
  toGroupSummary,
  toMember,
  toMemberPreview,
  toOutgoingRequest,
  toRequest,
  toShare,
  toSharedList,
} from "./friend-group-presenters.js";

const GROUP_ID = "group-1";
const USER_ID = "user-1";

function groupRow(overrides: Partial<Group> = {}): Group {
  return {
    id: GROUP_ID,
    slug: "summoner-skirmish",
    previousSlug: null,
    name: "Summoner Skirmish",
    description: "Tuesday nights",
    code: "ABCDEFGHIJKL",
    codeRotatedAt: new Date("2026-03-01T10:00:00.000Z"),
    bannerUrl: null,
    bannerPosition: 50,
    bannerUploadedBy: null,
    bannerUploadedAt: null,
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    updatedAt: new Date("2026-03-02T10:00:00.000Z"),
    ...overrides,
  };
}

describe("toGroup", () => {
  it("serializes the dates and keeps the code when the viewer may see it", () => {
    expect(toGroup(groupRow(), true)).toEqual({
      id: GROUP_ID,
      slug: "summoner-skirmish",
      name: "Summoner Skirmish",
      description: "Tuesday nights",
      bannerUrl: null,
      bannerPosition: 50,
      code: "ABCDEFGHIJKL",
      codeRotatedAt: "2026-03-01T10:00:00.000Z",
      createdAt: "2026-02-01T10:00:00.000Z",
      updatedAt: "2026-03-02T10:00:00.000Z",
    });
  });

  it("nulls the code when the viewer may not see it", () => {
    expect(toGroup(groupRow(), false).code).toBeNull();
  });
});

describe("canSeeCode", () => {
  it("admits owners and admins only", () => {
    expect(canSeeCode("owner")).toBe(true);
    expect(canSeeCode("admin")).toBe(true);
    expect(canSeeCode("member")).toBe(false);
  });
});

describe("toMemberPreview", () => {
  it("hashes the email instead of exposing it", () => {
    const row: MemberPreviewRow = {
      userId: USER_ID,
      userName: "Ekko",
      userImage: null,
      userEmail: " Ekko@Example.COM ",
    };
    expect(toMemberPreview(row)).toEqual({
      userId: USER_ID,
      userName: "Ekko",
      userImage: null,
      gravatarHash: gravatarHashForEmail("ekko@example.com"),
    });
    expect(toMemberPreview(row)).not.toHaveProperty("userEmail");
  });
});

describe("toMember", () => {
  it("carries the role, the joined date and the passed contact methods", () => {
    const row: MemberWithUser = {
      groupId: GROUP_ID,
      userId: USER_ID,
      userName: "Jinx",
      userImage: "https://cdn.example/jinx.png",
      userEmail: "jinx@example.com",
      role: "admin",
      joinedAt: new Date("2026-02-10T08:00:00.000Z"),
    };
    expect(toMember(row, [])).toEqual({
      userId: USER_ID,
      userName: "Jinx",
      userImage: "https://cdn.example/jinx.png",
      gravatarHash: gravatarHashForEmail("jinx@example.com"),
      role: "admin",
      contactMethods: [],
      joinedAt: "2026-02-10T08:00:00.000Z",
    });
  });
});

describe("toShare", () => {
  it("passes the entry count through untouched", () => {
    const row: ShareRow = {
      groupId: GROUP_ID,
      listId: "list-1",
      userId: USER_ID,
      sharedAt: new Date("2026-03-05T12:00:00.000Z"),
      listName: "Trade binder",
      listIntent: "trade",
      listKind: "printing",
      entryCount: 12,
      userName: "Ekko",
    };
    expect(toShare(row)).toEqual({
      groupId: GROUP_ID,
      listId: "list-1",
      listName: "Trade binder",
      listIntent: "trade",
      listKind: "printing",
      entryCount: 12,
      userId: USER_ID,
      userName: "Ekko",
      sharedAt: "2026-03-05T12:00:00.000Z",
    });
  });
});

describe("groupCovers", () => {
  it("buckets cover rows by collection", () => {
    const rows: CollectionCoverRow[] = [
      { collectionId: "c1", printingId: "p1", imageId: "i1" },
      { collectionId: "c2", printingId: "p2", imageId: "i2" },
      { collectionId: "c1", printingId: "p3", imageId: "i3" },
    ];
    const grouped = groupCovers(rows);
    expect(grouped.get("c1")).toHaveLength(2);
    expect(grouped.get("c2")).toHaveLength(1);
    expect(grouped.get("c3")).toBeUndefined();
  });
});

describe("toCollectionShare", () => {
  const row: CollectionShareRow = {
    groupId: GROUP_ID,
    collectionId: "c1",
    userId: USER_ID,
    sharedAt: new Date("2026-03-06T09:00:00.000Z"),
    collectionName: "Main binder",
    userName: "Ekko",
    copyCount: 40,
  };

  it("maps covers to printing and image ids", () => {
    expect(
      toCollectionShare(row, [{ collectionId: "c1", printingId: "p1", imageId: "i1" }]),
    ).toEqual({
      groupId: GROUP_ID,
      collectionId: "c1",
      collectionName: "Main binder",
      userId: USER_ID,
      userName: "Ekko",
      sharedAt: "2026-03-06T09:00:00.000Z",
      copyCount: 40,
      coverPrintings: [{ printingId: "p1", imageId: "i1", landscape: false }],
    });
  });

  it("flags covers whose art is landscape", () => {
    const covers = [{ collectionId: "c1", printingId: "p1", imageId: "i1" }];
    expect(toCollectionShare(row, covers, new Set(["i1"])).coverPrintings).toEqual([
      { printingId: "p1", imageId: "i1", landscape: true },
    ]);
  });

  it("returns an empty cover list when none were loaded", () => {
    expect(toCollectionShare(row).coverPrintings).toEqual([]);
  });
});

describe("toRequest", () => {
  it("hashes the requester email", () => {
    const row: PendingRequestRow = {
      id: "req-1",
      userId: USER_ID,
      createdAt: new Date("2026-03-07T07:00:00.000Z"),
      userName: "Vi",
      userEmail: "vi@example.com",
      userImage: null,
    };
    expect(toRequest(row)).toEqual({
      id: "req-1",
      userId: USER_ID,
      userName: "Vi",
      userImage: null,
      gravatarHash: gravatarHashForEmail("vi@example.com"),
      createdAt: "2026-03-07T07:00:00.000Z",
    });
  });
});

describe("toGroupSummary", () => {
  it("hides the code from a plain member and carries the counts", () => {
    const summary = toGroupSummary({
      ...groupRow(),
      viewerRole: "member",
      memberCount: 3,
      pendingRequestCount: 1,
      sharedListCount: 2,
      memberPreviews: [],
      recentTradedCardCount: 4,
      tradedCardCount: 9,
    });
    expect(summary.code).toBeNull();
    expect(summary).toMatchObject({
      viewerRole: "member",
      memberCount: 3,
      pendingRequestCount: 1,
      sharedListCount: 2,
      memberPreviews: [],
      recentTradedCardCount: 4,
      tradedCardCount: 9,
    });
  });
});

describe("toOutgoingRequest", () => {
  it("serializes the request with its group", () => {
    expect(
      toOutgoingRequest({
        id: "inv-1",
        groupId: GROUP_ID,
        userId: USER_ID,
        direction: "request",
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
        groupName: "Summoner Skirmish",
        groupSlug: "summoner-skirmish",
        memberCount: 5,
      }),
    ).toEqual({
      id: "inv-1",
      groupId: GROUP_ID,
      groupSlug: "summoner-skirmish",
      groupName: "Summoner Skirmish",
      createdAt: "2026-03-01T10:00:00.000Z",
      memberCount: 5,
    });
  });
});

describe("toSharedList", () => {
  const list = {
    id: "list-1",
    userId: USER_ID,
    name: "Trade binder",
    intent: "trade" as const,
    kind: "copy" as const,
    defaultPricePref: null,
    defaultPriceAbsoluteCents: null,
    defaultTradeType: null,
    currency: null,
  };

  it("maps the owner and empty trade defaults", () => {
    expect(toSharedList({ list, ownerName: "Teemo" })).toEqual({
      id: "list-1",
      name: "Trade binder",
      intent: "trade",
      kind: "copy",
      ownerUserId: USER_ID,
      ownerName: "Teemo",
      tradeDefaults: { pricePref: null, priceAbsoluteCents: null, tradeType: null },
      currency: null,
    });
  });

  it("keeps set trade defaults", () => {
    const row = { list: { ...list, defaultPriceAbsoluteCents: 250 }, ownerName: null };
    expect(toSharedList(row).tradeDefaults.priceAbsoluteCents).toBe(250);
  });
});

describe("toDiscordLink", () => {
  const link = {
    id: "link-1",
    groupId: GROUP_ID,
    guildId: "guild-1",
    guildName: "Bandle City",
    code: null,
    codeExpiresAt: null,
    createdByUserId: USER_ID,
    createdAt: new Date("2026-03-01T10:00:00.000Z"),
    linkedAt: new Date("2026-03-02T10:00:00.000Z"),
    tradeChannelIds: [],
  };

  it("maps a linked guild", () => {
    expect(toDiscordLink(link)).toEqual({
      id: "link-1",
      guildId: "guild-1",
      guildName: "Bandle City",
      linkedAt: "2026-03-02T10:00:00.000Z",
    });
  });

  it("returns null for a pending link", () => {
    expect(toDiscordLink({ ...link, guildId: null, linkedAt: null })).toBeNull();
  });
});

describe("toAdminGroupBanner", () => {
  const row = {
    groupId: GROUP_ID,
    slug: "summoner-skirmish",
    name: "Summoner Skirmish",
    bannerUrl: "/media/banner.webp",
    bannerPosition: 40,
    bannerUploadedAt: new Date("2026-03-01T10:00:00.000Z"),
    uploaderUserId: USER_ID,
    uploaderName: "Teemo",
    uploaderEmail: "teemo@example.com",
    memberCount: 6,
  };

  it("renames the group fields and serializes the upload time", () => {
    expect(toAdminGroupBanner(row)).toEqual({
      groupId: GROUP_ID,
      groupSlug: "summoner-skirmish",
      groupName: "Summoner Skirmish",
      bannerUrl: "/media/banner.webp",
      bannerPosition: 40,
      uploadedAt: "2026-03-01T10:00:00.000Z",
      uploaderUserId: USER_ID,
      uploaderName: "Teemo",
      uploaderEmail: "teemo@example.com",
      memberCount: 6,
    });
  });

  it("keeps a missing upload time null", () => {
    expect(toAdminGroupBanner({ ...row, bannerUploadedAt: null }).uploadedAt).toBeNull();
  });
});
