import { describe, expect, it, vi } from "vitest";

import type { AdminAccess } from "../../../middleware/require-admin.js";
import type { WorkspaceRepos } from "./workspace-queue.js";
import {
  buildFaceQueueItems,
  buildListingItems,
  buildWorkspaceQueue,
  candidatePrintingCard,
  deskScopeFor,
} from "./workspace-queue.js";

const T1 = new Date("2026-10-18T09:00:00.000Z");

const LIVE = {
  shortCode: "OGN-030",
  setId: "OGN",
  rarity: "rare",
  artVariant: "normal",
  isSigned: false,
  isOvernumbered: false,
  markerSlugs: [],
  distributionChannelSlugs: [],
  finish: "normal",
  size: "standard",
  artist: "Kudos Studio",
  publicCode: "OGN-030/298",
  printedRulesText: null,
  printedEffectText: null,
  flavorText: null,
  language: "EN",
  printedName: null,
  printedYear: null,
};

function linked(printingId: string, provider: string, candidate: object) {
  return {
    id: `cp-${printingId}`,
    candidateCardId: "cc-1",
    provider,
    createdAt: T1,
    printedTotal: 298,
    printingId,
    faceId: `face-${printingId}`,
    side: 1,
    cardSlug: "jinx-loose-cannon",
    cardName: "Jinx, Loose Cannon",
    printingLabel: "OGN-030 normal EN",
    faceShortCode: "OGN-030",
    candidate: { ...LIVE, imageUrl: null, imageFingerprint: null, ...candidate },
    live: { ...LIVE, setReleasedAt: null, imageUrls: [], imageFingerprints: [] },
  };
}

function makeRepos() {
  const repos = {
    workspaceQueue: {
      uncheckedCardDifferences: vi.fn().mockResolvedValue([]),
      newCardDrafts: vi.fn().mockResolvedValue([]),
      uncheckedLinkedPrintings: vi
        .fn()
        .mockResolvedValue([
          linked("promo", "provider-a", { size: "oversized", artist: "Other" }),
          linked("base", "provider-a", { size: "oversized" }),
          linked("hidden", "provider-b", { size: "oversized" }),
        ]),
      newCandidatePrintings: vi.fn().mockResolvedValue([]),
      inactiveFaceImages: vi.fn().mockResolvedValue([
        {
          faceImageId: "img-1",
          imageFileId: "file-1",
          faceId: "face-promo",
          createdAt: T1,
          cardSlug: "jinx-loose-cannon",
          cardName: "Jinx, Loose Cannon",
          shortCode: "OGN-030",
          printingIds: ["promo"],
          isBack: false,
          rehostFailed: false,
        },
        {
          faceImageId: "img-2",
          imageFileId: "file-2",
          faceId: "face-base",
          createdAt: T1,
          cardSlug: "jinx-loose-cannon",
          cardName: "Jinx, Loose Cannon",
          shortCode: "OGN-030",
          printingIds: ["base"],
          isBack: false,
          rehostFailed: true,
        },
      ]),
      newCandidatePrintingCard: vi
        .fn()
        .mockResolvedValue({ provider: "provider-a", cardSlug: "jinx-loose-cannon" }),
    },
    workspaceRecords: {
      deskScope: vi.fn().mockResolvedValue({ promoIds: ["promo"], createdIds: [] }),
    },
    cardSubmissions: { pendingReviewQueueRows: vi.fn().mockResolvedValue([]) },
    candidateCards: { cardSlugsByNormNames: vi.fn().mockResolvedValue([]) },
    providerSettings: {
      helperReviewableProviders: vi.fn().mockResolvedValue(new Set(["provider-a"])),
    },
    keywords: { listCostKeywords: vi.fn().mockResolvedValue([]) },
    adminEvents: {},
  };
  return repos;
}

function ids(response: Awaited<ReturnType<typeof buildWorkspaceQueue>>): string[] {
  return response.items.map((item) => item.id).toSorted();
}

const ADMIN: AdminAccess = { isAdmin: true, sections: [] };
const HELPER: AdminAccess = { isAdmin: false, sections: ["card-review"] };
const DESK_HOLDER: AdminAccess = { isAdmin: false, sections: ["printing-desk"] };

function desk(promoIds: string[], createdIds: string[] = []) {
  return { promoIds: new Set(promoIds), createdIds: new Set(createdIds) };
}

describe("buildWorkspaceQueue", () => {
  it("returns every source to an admin", async () => {
    const repos = makeRepos();
    const response = await buildWorkspaceQueue(repos as unknown as WorkspaceRepos, {
      access: ADMIN,
      desk: undefined,
    });
    expect(ids(response)).toEqual([
      "face:image-rehost-failed:face-base:img-2",
      "face:new-image:face-promo:img-1",
      "face:source-difference:face-promo:provider-a",
      "printing:source-difference:base:provider-a",
      "printing:source-difference:hidden:provider-b",
      "printing:source-difference:promo:provider-a",
    ]);
    expect(repos.providerSettings.helperReviewableProviders).not.toHaveBeenCalled();
  });

  it("limits a card-review holder to sources helpers can review", async () => {
    const response = await buildWorkspaceQueue(makeRepos() as unknown as WorkspaceRepos, {
      access: HELPER,
      desk: undefined,
    });
    expect(ids(response)).not.toContain("printing:source-difference:hidden:provider-b");
    expect(ids(response)).toContain("face:source-difference:face-promo:provider-a");
  });

  it("limits a desk holder to printing items, uploads and failed rehosts on promo or own printings", async () => {
    const response = await buildWorkspaceQueue(makeRepos() as unknown as WorkspaceRepos, {
      access: DESK_HOLDER,
      desk: desk(["promo"], ["base"]),
    });
    expect(ids(response)).toEqual([
      "face:image-rehost-failed:face-base:img-2",
      "face:new-image:face-promo:img-1",
      "printing:source-difference:base:provider-a",
      "printing:source-difference:promo:provider-a",
    ]);
  });

  it("drops a desk holder's items on printings outside the desk", async () => {
    const response = await buildWorkspaceQueue(makeRepos() as unknown as WorkspaceRepos, {
      access: DESK_HOLDER,
      desk: desk(["promo"]),
    });
    expect(ids(response)).toEqual([
      "face:new-image:face-promo:img-1",
      "printing:source-difference:promo:provider-a",
    ]);
  });
});

describe("deskScopeFor", () => {
  it("reads the scope for a desk holder only", async () => {
    const repos = makeRepos();
    await expect(
      deskScopeFor(repos as unknown as WorkspaceRepos, ADMIN, "admin-1"),
    ).resolves.toBeUndefined();
    await expect(
      deskScopeFor(repos as unknown as WorkspaceRepos, HELPER, "helper-1"),
    ).resolves.toBeUndefined();
    await expect(
      deskScopeFor(repos as unknown as WorkspaceRepos, DESK_HOLDER, "desk-1"),
    ).resolves.toEqual(desk(["promo"]));
    expect(repos.workspaceRecords.deskScope).toHaveBeenCalledTimes(1);
    expect(repos.workspaceRecords.deskScope).toHaveBeenCalledWith("desk-1");
  });
});

describe("buildFaceQueueItems", () => {
  it("returns the face items of the queue without reading the other sources", async () => {
    const repos = makeRepos();
    const items = await buildFaceQueueItems(repos as unknown as WorkspaceRepos, {
      access: ADMIN,
      desk: undefined,
    });
    expect(items.map((item) => item.id).toSorted()).toEqual([
      "face:image-rehost-failed:face-base:img-2",
      "face:new-image:face-promo:img-1",
      "face:source-difference:face-promo:provider-a",
    ]);
    expect(repos.workspaceQueue.uncheckedCardDifferences).not.toHaveBeenCalled();
    expect(repos.workspaceQueue.newCardDrafts).not.toHaveBeenCalled();
    expect(repos.workspaceQueue.newCandidatePrintings).not.toHaveBeenCalled();
    expect(repos.cardSubmissions.pendingReviewQueueRows).not.toHaveBeenCalled();
  });

  it("applies the desk scope it is given", async () => {
    const items = await buildFaceQueueItems(makeRepos() as unknown as WorkspaceRepos, {
      access: DESK_HOLDER,
      desk: desk(["promo"]),
    });
    expect(items.map((item) => item.id)).toEqual(["face:new-image:face-promo:img-1"]);
  });
});

describe("candidatePrintingCard", () => {
  const ID = "0f9a3c1e-2b4d-4e6f-8a1b-3c5d7e9f1a2b";

  it("returns the card of an open new printing", async () => {
    const repos = makeRepos();
    await expect(
      candidatePrintingCard(repos as unknown as WorkspaceRepos, {
        access: ADMIN,
        candidatePrintingId: ID,
      }),
    ).resolves.toEqual({ cardSlug: "jinx-loose-cannon" });
    expect(repos.workspaceQueue.newCandidatePrintingCard).toHaveBeenCalledWith(ID);
  });

  it("returns null for a candidate the caller cannot review", async () => {
    const repos = makeRepos();
    repos.workspaceQueue.newCandidatePrintingCard.mockResolvedValue({
      provider: "provider-b",
      cardSlug: "jinx-loose-cannon",
    });
    await expect(
      candidatePrintingCard(repos as unknown as WorkspaceRepos, {
        access: HELPER,
        candidatePrintingId: ID,
      }),
    ).resolves.toEqual({ cardSlug: null });
  });

  it("returns null for a gone candidate, a desk holder and a non-uuid id", async () => {
    const repos = makeRepos();
    repos.workspaceQueue.newCandidatePrintingCard.mockResolvedValueOnce(undefined);
    const lookup = (access: AdminAccess, candidatePrintingId: string) =>
      candidatePrintingCard(repos as unknown as WorkspaceRepos, { access, candidatePrintingId });
    await expect(lookup(ADMIN, ID)).resolves.toEqual({ cardSlug: null });
    await expect(lookup(DESK_HOLDER, ID)).resolves.toEqual({ cardSlug: null });
    await expect(lookup(ADMIN, "listing:tcgplayer:7:normal")).resolves.toEqual({ cardSlug: null });
    expect(repos.workspaceQueue.newCandidatePrintingCard).toHaveBeenCalledTimes(1);
  });
});

describe("buildListingItems", () => {
  it("turns listings into printing items", () => {
    const response = buildListingItems({
      suggested: [
        {
          marketplace: "tcgplayer",
          externalId: 7,
          finish: "normal",
          language: null,
          productName: "Jinx Loose Cannon",
          createdAt: T1,
          printingId: "base",
          printingLabel: "OGN-030 normal EN",
          cardSlug: "jinx-loose-cannon",
          cardName: "Jinx, Loose Cannon",
          score: 150,
          strength: "strong",
        },
      ],
      unmatched: [
        {
          marketplace: "cardnexus",
          externalId: 9,
          finish: "foil",
          language: "EN",
          productName: "Mystery Box",
          createdAt: T1,
          card: null,
        },
        ...[10, 11].map((externalId) => ({
          marketplace: "cardtrader",
          externalId,
          finish: "foil",
          language: "FR",
          productName: "Jinx, Loose Cannon",
          createdAt: T1,
          card: { slug: "jinx-loose-cannon", name: "Jinx, Loose Cannon" },
        })),
      ],
    } as never);
    expect(ids(response)).toContain("printing:listing:base:tcgplayer");
    expect(ids(response)).toContain("printing:listing:listing:cardnexus:9:foil:EN");
    expect(ids(response)).toContain("printing:listing:listing-card:jinx-loose-cannon");
    expect(response.items.filter((item) => item.segment === "new")).toHaveLength(2);
  });
});
