import { describe, expect, it, vi } from "vitest";

import type { WorkspaceRepos } from "./workspace-queue.js";
import { buildWorkspaceQueue } from "./workspace-queue.js";

const T1 = new Date("2026-10-18T09:00:00.000Z");
const NOW = new Date("2026-10-21T15:30:00.000Z");

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
    live: { ...LIVE, imageUrls: [], imageFingerprints: [] },
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
          imageId: "img-1",
          faceId: "face-promo",
          createdAt: T1,
          cardSlug: "jinx-loose-cannon",
          cardName: "Jinx, Loose Cannon",
          shortCode: "OGN-030",
          printingIds: ["promo"],
          isBack: false,
        },
        {
          imageId: "img-2",
          faceId: "face-base",
          createdAt: T1,
          cardSlug: "jinx-loose-cannon",
          cardName: "Jinx, Loose Cannon",
          shortCode: "OGN-030",
          printingIds: ["base"],
          isBack: false,
        },
      ]),
      countAdminEventsSince: vi.fn().mockResolvedValue(3),
    },
    workspaceRecords: {},
    cardSubmissions: { pendingReviewQueueRows: vi.fn().mockResolvedValue([]) },
    candidateCards: { cardSlugsByNormNames: vi.fn().mockResolvedValue([]) },
    providerSettings: {
      helperReviewableProviders: vi.fn().mockResolvedValue(new Set(["provider-a"])),
    },
    keywords: { listCostKeywords: vi.fn().mockResolvedValue([]) },
    printingDesk: {
      listDeskPrintings: vi.fn().mockResolvedValue([{ printingId: "promo" }]),
    },
    adminEvents: { printingIdsCreatedBy: vi.fn().mockResolvedValue([]) },
  };
  return repos;
}

function ids(response: Awaited<ReturnType<typeof buildWorkspaceQueue>>): string[] {
  return response.items.map((item) => item.id).toSorted();
}

describe("buildWorkspaceQueue", () => {
  it("returns every source to an admin and counts today's events from UTC midnight", async () => {
    const repos = makeRepos();
    const response = await buildWorkspaceQueue(repos as unknown as WorkspaceRepos, {
      access: { isAdmin: true, sections: [] },
      userId: "admin-1",
      now: NOW,
    });
    expect(ids(response)).toEqual([
      "face:new-image:face-base:img-2",
      "face:new-image:face-promo:img-1",
      "face:source-difference:face-promo:provider-a",
      "printing:source-difference:base:provider-a",
      "printing:source-difference:hidden:provider-b",
      "printing:source-difference:promo:provider-a",
    ]);
    expect(response.doneToday).toBe(3);
    expect(repos.workspaceQueue.countAdminEventsSince).toHaveBeenCalledWith(
      "admin-1",
      new Date("2026-10-21T00:00:00.000Z"),
    );
    expect(repos.providerSettings.helperReviewableProviders).not.toHaveBeenCalled();
  });

  it("limits a card-review holder to sources helpers can review", async () => {
    const response = await buildWorkspaceQueue(makeRepos() as unknown as WorkspaceRepos, {
      access: { isAdmin: false, sections: ["card-review"] },
      userId: "helper-1",
      now: NOW,
    });
    expect(ids(response)).not.toContain("printing:source-difference:hidden:provider-b");
    expect(ids(response)).toContain("face:source-difference:face-promo:provider-a");
  });

  it("limits a desk holder to printing items and uploads on promo or own printings", async () => {
    const repos = makeRepos();
    repos.adminEvents.printingIdsCreatedBy.mockResolvedValue(["base"]);
    repos.printingDesk.listDeskPrintings.mockResolvedValue([{ printingId: "promo" }]);
    const response = await buildWorkspaceQueue(repos as unknown as WorkspaceRepos, {
      access: { isAdmin: false, sections: ["printing-desk"] },
      userId: "desk-1",
      now: NOW,
    });
    expect(ids(response)).toEqual([
      "face:new-image:face-base:img-2",
      "face:new-image:face-promo:img-1",
      "printing:source-difference:base:provider-a",
      "printing:source-difference:promo:provider-a",
    ]);
    expect(repos.printingDesk.listDeskPrintings).toHaveBeenCalledWith({ promosOnly: true });
  });

  it("adds listings to an admin's printing queues and counts them", async () => {
    const loadListings = vi.fn().mockResolvedValue({
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
    });
    const response = await buildWorkspaceQueue(makeRepos() as unknown as WorkspaceRepos, {
      access: { isAdmin: true, sections: [] },
      userId: "admin-1",
      owner: "printing",
      now: NOW,
      loadListings,
    });
    expect(ids(response)).toContain("printing:listing:base:tcgplayer");
    expect(ids(response)).toContain("printing:listing:listing:cardnexus:9:foil:EN");
    expect(ids(response)).toContain("printing:listing:listing-card:jinx-loose-cannon");
    expect(response.counts.printing).toEqual({ open: 4, new: 2, oldestAt: T1.toISOString() });
  });

  it("never loads listings for a card-review or desk holder", async () => {
    const loadListings = vi.fn();
    for (const section of ["card-review", "printing-desk"] as const) {
      await buildWorkspaceQueue(makeRepos() as unknown as WorkspaceRepos, {
        access: { isAdmin: false, sections: [section] },
        userId: "helper-1",
        now: NOW,
        loadListings,
      });
    }
    expect(loadListings).not.toHaveBeenCalled();
  });

  it("drops a desk holder's items on printings outside the desk", async () => {
    const response = await buildWorkspaceQueue(makeRepos() as unknown as WorkspaceRepos, {
      access: { isAdmin: false, sections: ["printing-desk"] },
      userId: "desk-1",
      owner: "printing",
      now: NOW,
    });
    expect(ids(response)).toEqual(["printing:source-difference:promo:provider-a"]);
    expect(response.counts.face).toEqual({ open: 1, new: 0, oldestAt: T1.toISOString() });
  });
});
