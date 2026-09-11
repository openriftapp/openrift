import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { publicUserShareRouter } from "./public-user-share";

const mockUserSharesRepo = {
  findOwnerByShareToken: vi.fn(),
  listsForOwner: vi.fn(),
  findListInBundle: vi.fn(),
};

const mockFriendGroupsRepo = {
  collectionsBundleForViewer: vi.fn(),
  sharedGroups: vi.fn(),
  revealedContactsForViewer: vi.fn(),
};

const mockListsRepo = {
  entriesWithDetailsAnon: vi.fn(),
  entriesWithDetails: vi.fn(),
  listForUser: vi.fn(),
};

const mockUserProfileRepo = {
  lastActiveAt: vi.fn(),
  collectionSummary: vi.fn(),
  acceptedSubmissionCounts: vi.fn(),
  metaEventCredits: vi.fn(),
  deckSummary: vi.fn(),
  completedTournamentParticipations: vi.fn(),
  cardIdsForPrintings: vi.fn(),
  collectionPreviewImageIds: vi.fn(),
};

const mockCanonicalPrintingsRepo = {
  resolvePrintingMetaForRows: vi.fn(),
};

const mockPodTournamentsRepo = {
  computeStandings: vi.fn(),
};

let currentUser: { id: string } | null = null;

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  if (currentUser) {
    c.set("user", currentUser as never);
  }
  c.set("repos", {
    userShares: mockUserSharesRepo,
    friendGroups: mockFriendGroupsRepo,
    lists: mockListsRepo,
    userProfile: mockUserProfileRepo,
    canonicalPrintings: mockCanonicalPrintingsRepo,
    podTournaments: mockPodTournamentsRepo,
  } as never);
  await next();
});
registerRouterForTest(app, publicUserShareRouter);

const OWNER_ID = "a0000000-0001-4000-a000-000000000001";
const VIEWER_ID = "v0000000-0001-4000-a000-000000000099";
const LIST_ID = "a0000000-0001-4000-a000-000000000010";
const NOW = new Date("2026-04-20T00:00:00Z");
const JOINED = new Date("2026-03-06T10:00:00Z");

const dbOwner = {
  userId: OWNER_ID,
  displayName: "Alice",
  email: "alice@example.com",
  image: null,
  bio: "Fury and Chaos player.",
  riotId: "Alice#EUW",
  createdAt: JOINED,
  profileShowRiotId: true,
  profileShowCollection: true,
  profileShowLastActive: true,
};

const dbList = {
  id: LIST_ID,
  userId: OWNER_ID,
  name: "Trade Binder",
  intent: "trade" as const,
  kind: "card" as const,
  shareToken: "list-tok",
  createdAt: NOW,
  updatedAt: NOW,
  defaultPricePref: null,
  defaultPriceAbsoluteCents: null,
  defaultTradeType: null,
  currency: null,
};

const dbEntry = {
  kind: "card" as const,
  id: "a0000000-0001-4000-a000-000000000020",
  listId: LIST_ID,
  quantity: 2,
  ruleQuantity: 0,
  source: "manual" as const,
  cardId: "c0000000-0001-4000-a000-000000000001",
  cardName: "Jinx, Rebel",
  tradeOverride: { pricePref: null, priceAbsoluteCents: null, tradeType: null },
};

const cardEntry = (cardId: string) => ({ ...dbEntry, cardId });

function resetProfileMocks() {
  mockUserProfileRepo.lastActiveAt.mockResolvedValue(null);
  mockUserProfileRepo.collectionSummary.mockResolvedValue({ copies: 0, uniqueCards: 0 });
  mockUserProfileRepo.acceptedSubmissionCounts.mockResolvedValue({
    corrections: 0,
    newCards: 0,
    images: 0,
  });
  mockUserProfileRepo.metaEventCredits.mockResolvedValue(0);
  mockUserProfileRepo.deckSummary.mockResolvedValue({ total: 0, topLegend: null });
  mockUserProfileRepo.completedTournamentParticipations.mockResolvedValue([]);
  mockUserProfileRepo.cardIdsForPrintings.mockResolvedValue(new Map());
  mockUserProfileRepo.collectionPreviewImageIds.mockResolvedValue(new Map());
  mockCanonicalPrintingsRepo.resolvePrintingMetaForRows.mockImplementation(
    (rows: { cardId: string }[]) =>
      Promise.resolve(rows.map(({ cardId }) => ({ cardId, imageId: `img-${cardId}` }))),
  );
  mockListsRepo.entriesWithDetailsAnon.mockResolvedValue([]);
  mockListsRepo.entriesWithDetails.mockResolvedValue([]);
  mockListsRepo.listForUser.mockResolvedValue([]);
  mockFriendGroupsRepo.sharedGroups.mockResolvedValue([]);
  mockFriendGroupsRepo.revealedContactsForViewer.mockResolvedValue([]);
  mockFriendGroupsRepo.collectionsBundleForViewer.mockResolvedValue([]);
}

describe("GET /api/v1/users/share/:token", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    currentUser = null;
    resetProfileMocks();
  });

  it("returns 200 with the owner profile, stats and visible lists", async () => {
    mockUserSharesRepo.findOwnerByShareToken.mockResolvedValue(dbOwner);
    mockUserSharesRepo.listsForOwner.mockResolvedValue([
      { list: dbList, entryCount: 3, viaGroups: [] },
    ]);
    mockListsRepo.entriesWithDetailsAnon.mockResolvedValue([
      cardEntry("c-1"),
      cardEntry("c-2"),
      cardEntry("c-3"),
    ]);
    mockUserProfileRepo.lastActiveAt.mockResolvedValue(new Date());
    mockUserProfileRepo.collectionSummary.mockResolvedValue({ copies: 1284, uniqueCards: 312 });
    mockUserProfileRepo.acceptedSubmissionCounts.mockResolvedValue({
      corrections: 9,
      newCards: 1,
      images: 3,
    });
    mockUserProfileRepo.metaEventCredits.mockResolvedValue(2);
    mockUserProfileRepo.deckSummary.mockResolvedValue({
      total: 19,
      topLegend: { name: "Jinx, Loose Cannon", slug: "jinx-loose-cannon" },
    });

    const res = await app.request("/api/v1/users/share/tok-abc");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.owner).toEqual({
      displayName: "Alice",
      gravatarHash: expect.any(String),
      userId: null,
      isViewer: false,
      bio: "Fury and Chaos player.",
      riotId: "Alice#EUW",
      memberSince: JOINED.toISOString(),
      lastActive: "today",
      isContributor: true,
    });
    expect(json.stats).toEqual({
      collection: { copies: 1284, uniqueCards: 312 },
      contributions: { total: 15, cardFixes: 9, newCards: 1, photos: 3, metaEvents: 2 },
      tournaments: { played: 0, bestFinish: null },
      decks: { total: 19, topLegend: { name: "Jinx, Loose Cannon", slug: "jinx-loose-cannon" } },
    });
    expect(json.groupsInCommon).toEqual([]);
    expect(json.contactMethods).toEqual([]);
    expect(json.overlap).toBeNull();
    expect(json.lists).toHaveLength(1);
    expect(json.lists[0]).toMatchObject({
      id: LIST_ID,
      name: "Trade Binder",
      intent: "trade",
      kind: "card",
      entryCount: 3,
      isPublic: true,
      viaGroups: [],
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      previewImageIds: ["img-c-1", "img-c-2", "img-c-3"],
      matchCount: null,
    });
    expect(json.collections).toEqual([]);
    expect(mockFriendGroupsRepo.collectionsBundleForViewer).not.toHaveBeenCalled();
    expect(mockFriendGroupsRepo.sharedGroups).not.toHaveBeenCalled();
    expect(mockListsRepo.listForUser).not.toHaveBeenCalled();
  });

  it("reports the expanded size of a rule-based list instead of its materialized count", async () => {
    const ruledList = {
      ...dbList,
      id: "a0000000-0001-4000-a000-000000000011",
      name: "Smart Trades",
      rules: [{ kind: "trade", filter: {} }],
    };
    mockUserSharesRepo.findOwnerByShareToken.mockResolvedValue(dbOwner);
    mockUserSharesRepo.listsForOwner.mockResolvedValue([
      { list: ruledList, entryCount: 0, viaGroups: [] },
    ]);
    mockListsRepo.entriesWithDetailsAnon.mockResolvedValue([
      cardEntry("c-1"),
      cardEntry("c-2"),
      cardEntry("c-3"),
      cardEntry("c-4"),
    ]);

    const res = await app.request("/api/v1/users/share/tok-abc");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.lists[0]).toMatchObject({ id: ruledList.id, entryCount: 4, hasRule: true });
    expect(mockListsRepo.entriesWithDetailsAnon).toHaveBeenCalledWith(ruledList.id, "card");
  });

  it("hides the Riot ID, last active and collection size when the owner opted out", async () => {
    mockUserSharesRepo.findOwnerByShareToken.mockResolvedValue({
      ...dbOwner,
      profileShowRiotId: false,
      profileShowCollection: false,
      profileShowLastActive: false,
    });
    mockUserSharesRepo.listsForOwner.mockResolvedValue([]);

    const res = await app.request("/api/v1/users/share/tok-abc");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.owner).toMatchObject({ riotId: null, lastActive: null, isContributor: false });
    expect(json.stats.collection).toBeNull();
    expect(mockUserProfileRepo.lastActiveAt).not.toHaveBeenCalled();
    expect(mockUserProfileRepo.collectionSummary).not.toHaveBeenCalled();
  });

  it("computes the overlap, per-list matches and groups in common for another signed-in viewer", async () => {
    currentUser = { id: VIEWER_ID };
    const wishList = {
      ...dbList,
      id: "a0000000-0001-4000-a000-000000000012",
      name: "Wants",
      intent: "wish" as const,
    };
    mockUserSharesRepo.findOwnerByShareToken.mockResolvedValue(dbOwner);
    mockUserSharesRepo.listsForOwner.mockResolvedValue([
      { list: dbList, entryCount: 2, viaGroups: [] },
      { list: wishList, entryCount: 2, viaGroups: [{ id: "g1", slug: "buds", name: "Buds" }] },
    ]);
    mockListsRepo.entriesWithDetailsAnon.mockImplementation((listId: string) =>
      Promise.resolve(
        listId === LIST_ID
          ? [cardEntry("c-offer-1"), cardEntry("c-offer-2")]
          : [cardEntry("c-want-1"), cardEntry("c-want-2")],
      ),
    );
    mockListsRepo.listForUser.mockImplementation((_: string, intent?: string) =>
      Promise.resolve(
        intent === "wish"
          ? [{ id: "viewer-wish", kind: "card", intent: "wish" }]
          : [{ id: "viewer-trade", kind: "card", intent: "trade" }],
      ),
    );
    mockListsRepo.entriesWithDetails.mockImplementation((listId: string) =>
      Promise.resolve(
        listId === "viewer-wish"
          ? [cardEntry("c-offer-2")]
          : [cardEntry("c-want-1"), cardEntry("c-want-2")],
      ),
    );
    mockFriendGroupsRepo.sharedGroups.mockResolvedValue([{ id: "g1", slug: "buds", name: "Buds" }]);
    mockFriendGroupsRepo.revealedContactsForViewer.mockResolvedValue([
      { id: "cm-1", type: "discord", value: "alice" },
    ]);
    mockFriendGroupsRepo.collectionsBundleForViewer.mockResolvedValue([
      {
        collectionId: "col-1",
        collectionName: "Main",
        collectionDescription: "My cards",
        viaGroups: [{ id: "g1", slug: "buds", name: "Buds" }],
      },
    ]);
    mockUserProfileRepo.collectionPreviewImageIds.mockResolvedValue(
      new Map([["col-1", ["img-a", "img-b"]]]),
    );

    const res = await app.request("/api/v1/users/share/tok-abc");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.owner.userId).toBe(OWNER_ID);
    expect(json.groupsInCommon).toEqual([{ id: "g1", slug: "buds", name: "Buds" }]);
    expect(json.contactMethods).toEqual([{ id: "cm-1", type: "discord", value: "alice" }]);
    expect(json.overlap).toEqual({ theyWantYouHave: 2, theyOfferYouWant: 1 });
    const byId = new Map(
      (json.lists as { id: string; matchCount: number }[]).map((l) => [l.id, l.matchCount]),
    );
    expect(byId.get(LIST_ID)).toBe(1);
    expect(byId.get(wishList.id)).toBe(2);
    expect(json.collections).toEqual([
      {
        id: "col-1",
        name: "Main",
        description: "My cards",
        viaGroups: [{ id: "g1", slug: "buds", name: "Buds" }],
        previewImageIds: ["img-a", "img-b"],
      },
    ]);
    expect(mockUserProfileRepo.collectionPreviewImageIds).toHaveBeenCalledWith(["col-1"], 4);
    expect(mockFriendGroupsRepo.sharedGroups).toHaveBeenCalledWith(VIEWER_ID, OWNER_ID);
    expect(mockFriendGroupsRepo.revealedContactsForViewer).toHaveBeenCalledWith(
      OWNER_ID,
      VIEWER_ID,
    );
    expect(mockFriendGroupsRepo.collectionsBundleForViewer).toHaveBeenCalledWith(
      OWNER_ID,
      VIEWER_ID,
    );
  });

  it("skips the overlap when the owner views their own profile", async () => {
    currentUser = { id: OWNER_ID };
    mockUserSharesRepo.findOwnerByShareToken.mockResolvedValue(dbOwner);
    mockUserSharesRepo.listsForOwner.mockResolvedValue([
      { list: dbList, entryCount: 1, viaGroups: [] },
    ]);
    mockListsRepo.entriesWithDetailsAnon.mockResolvedValue([cardEntry("c-1")]);

    const res = await app.request("/api/v1/users/share/tok-abc");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.overlap).toBeNull();
    expect(json.owner.userId).toBeNull();
    expect(json.owner.isViewer).toBe(true);
    expect(json.lists[0].matchCount).toBeNull();
    expect(mockFriendGroupsRepo.sharedGroups).not.toHaveBeenCalled();
    expect(mockFriendGroupsRepo.revealedContactsForViewer).toHaveBeenCalledWith(OWNER_ID, OWNER_ID);
    expect(mockListsRepo.listForUser).not.toHaveBeenCalled();
  });

  it("falls back to 'Anonymous' when the owner has no display name", async () => {
    mockUserSharesRepo.findOwnerByShareToken.mockResolvedValue({
      ...dbOwner,
      displayName: null,
    });
    mockUserSharesRepo.listsForOwner.mockResolvedValue([]);

    const res = await app.request("/api/v1/users/share/tok-abc");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.owner.displayName).toBe("Anonymous");
  });

  it("returns 404 when the token does not resolve to an owner", async () => {
    mockUserSharesRepo.findOwnerByShareToken.mockResolvedValue(undefined);

    const res = await app.request("/api/v1/users/share/unknown");
    expect(res.status).toBe(404);
    const json = await readJson(res);
    expect(json.message).toBe("Not found");
    expect(mockUserSharesRepo.listsForOwner).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/users/share/:token/lists/:listId", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    currentUser = null;
  });

  it("returns 200 with the list, entries, and owner", async () => {
    mockUserSharesRepo.findListInBundle.mockResolvedValue(dbList);
    mockUserSharesRepo.findOwnerByShareToken.mockResolvedValue(dbOwner);
    mockListsRepo.entriesWithDetailsAnon.mockResolvedValue([dbEntry]);

    const res = await app.request(`/api/v1/users/share/tok-abc/lists/${LIST_ID}`);
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.list.id).toBe(LIST_ID);
    expect(json.list.name).toBe("Trade Binder");
    expect(json.entries).toHaveLength(1);
    expect(json.entries[0]).toMatchObject({ id: dbEntry.id, cardName: "Jinx, Rebel" });
    expect(json.owner.displayName).toBe("Alice");
    expect(mockListsRepo.entriesWithDetailsAnon).toHaveBeenCalledWith(LIST_ID, dbList.kind);
  });

  it("returns 404 when the list is not visible in the bundle", async () => {
    mockUserSharesRepo.findListInBundle.mockResolvedValue(undefined);

    const res = await app.request(`/api/v1/users/share/tok-abc/lists/${LIST_ID}`);
    expect(res.status).toBe(404);
    const json = await readJson(res);
    expect(json.message).toBe("Not found");
    expect(mockListsRepo.entriesWithDetailsAnon).not.toHaveBeenCalled();
  });

  it("returns 400 when the listId is not a UUID", async () => {
    const res = await app.request("/api/v1/users/share/tok-abc/lists/not-a-uuid");
    expect(res.status).toBe(400);
    expect(mockUserSharesRepo.findListInBundle).not.toHaveBeenCalled();
  });
});
