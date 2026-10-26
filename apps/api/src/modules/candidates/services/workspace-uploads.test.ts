import type { WorkspaceQueueItem } from "@openrift/shared/contracts/admin/catalog-workspace";
import { describe, expect, it, vi } from "vitest";

import type { WorkspaceCardDifferenceRow } from "../repositories/workspace-queue.js";
import type { WorkspaceRepos } from "./workspace-queue.js";
import {
  buildWorkspaceUploads,
  largestRepeatedDifference,
  toWorkspaceUploads,
} from "./workspace-uploads.js";

const T1 = new Date("2026-10-18T09:00:00.000Z");
const T2 = new Date("2026-10-20T09:00:00.000Z");
const NOW = new Date("2026-10-21T15:30:00.000Z");

const LIVE = {
  name: "Jinx, Loose Cannon",
  types: ["unit"],
  superTypes: ["champion"],
  domains: ["chaos"],
  might: 3,
  energy: 4,
  power: 1,
  mightBonus: null,
  tags: ["Jinx"],
};

function diff(
  id: string,
  candidate: Partial<typeof LIVE>,
  provider = "gallery",
): WorkspaceCardDifferenceRow {
  return {
    id,
    provider,
    createdAt: T1,
    cardSlug: `card-${id}`,
    cardName: `Card ${id}`,
    candidate: { ...LIVE, ...candidate },
    live: LIVE,
  };
}

function item(over: Partial<WorkspaceQueueItem>): WorkspaceQueueItem {
  return {
    id: "card:source-difference:card-a:gallery",
    owner: "card",
    segment: "open",
    ownerId: "card-a",
    cardSlug: "card-a",
    cardName: "Card a",
    label: "Card a",
    reason: "source-difference",
    provider: "gallery",
    isContributor: false,
    decisions: 1,
    fields: ["might"],
    createdAt: T2.toISOString(),
    ...over,
  };
}

const UPLOAD = {
  provider: "gallery",
  uploadedAt: T2,
  counts: {
    newCards: 2,
    newPrintings: 5,
    updates: 3,
    printingUpdates: 4,
    removedCards: 1,
    removedPrintings: 2,
  },
};

describe("largestRepeatedDifference", () => {
  it("returns the largest field and value group of the provider", () => {
    const rows = [
      diff("a", { might: 4 }),
      diff("b", { might: 4, energy: 5 }),
      diff("c", { might: 4, energy: 5 }),
      diff("d", { might: 4 }, "other"),
    ];
    expect(largestRepeatedDifference(rows, "gallery")).toEqual({
      field: "might",
      value: "4",
      count: 3,
    });
  });

  it("returns null when no difference repeats", () => {
    const rows = [diff("a", { might: 4 }), diff("b", { might: 5 }), diff("c", {})];
    expect(largestRepeatedDifference(rows, "gallery")).toBeNull();
  });

  it("ignores other providers", () => {
    const rows = [diff("a", { might: 4 }, "other"), diff("b", { might: 4 }, "other")];
    expect(largestRepeatedDifference(rows, "gallery")).toBeNull();
  });
});

describe("toWorkspaceUploads", () => {
  it("sums card and printing counts and counts the provider's queue items", () => {
    const items = [
      item({ id: "1", createdAt: T2.toISOString() }),
      item({ id: "2", segment: "new", createdAt: T1.toISOString() }),
      item({ id: "3", provider: "other" }),
    ];
    const response = toWorkspaceUploads([UPLOAD], items, []);
    expect(response.sources).toEqual([
      {
        provider: "gallery",
        label: "gallery",
        uploadedAt: T2.toISOString(),
        newCards: 2,
        newPrintings: 5,
        updates: 7,
        removed: 3,
        open: 1,
        new: 1,
        oldestOpenAt: T1.toISOString(),
        repeatedDifference: null,
      },
    ]);
  });

  it("orders sources newest upload first and reads missing counts as zero", () => {
    const response = toWorkspaceUploads(
      [
        { provider: "old", uploadedAt: T1, counts: null },
        { provider: "fresh", uploadedAt: T2, counts: { newCards: "x" } },
      ],
      [],
      [],
    );
    expect(response.sources.map((source) => source.provider)).toEqual(["fresh", "old"]);
    expect(response.sources[0]).toMatchObject({ newCards: 0, open: 0, oldestOpenAt: null });
  });

  it("counts contributor items with the oldest as since", () => {
    const response = toWorkspaceUploads(
      [],
      [
        item({ id: "1", isContributor: true, provider: null, createdAt: T2.toISOString() }),
        item({ id: "2", isContributor: true, createdAt: T1.toISOString() }),
        item({ id: "3" }),
      ],
      [],
    );
    expect(response.contributors).toEqual({ since: T1.toISOString(), count: 2 });
  });

  it("reports no contributors as a null since", () => {
    expect(toWorkspaceUploads([], [], []).contributors).toEqual({ since: null, count: 0 });
  });
});

function makeRepos(differences: WorkspaceCardDifferenceRow[]) {
  return {
    workspaceQueue: {
      uncheckedCardDifferences: vi.fn().mockResolvedValue(differences),
      newCardDrafts: vi.fn().mockResolvedValue([]),
      uncheckedLinkedPrintings: vi.fn().mockResolvedValue([]),
      newCandidatePrintings: vi.fn().mockResolvedValue([]),
      inactiveFaceImages: vi.fn().mockResolvedValue([]),
      countAdminEventsSince: vi.fn().mockResolvedValue(0),
    },
    workspaceRecords: {
      latestUploads: vi
        .fn()
        .mockResolvedValue([UPLOAD, { provider: "hidden-source", uploadedAt: T1, counts: {} }]),
    },
    cardSubmissions: { pendingReviewQueueRows: vi.fn().mockResolvedValue([]) },
    candidateCards: { cardSlugsByNormNames: vi.fn().mockResolvedValue([]) },
    providerSettings: {
      helperReviewableProviders: vi.fn().mockResolvedValue(new Set(["gallery"])),
    },
    keywords: { listCostKeywords: vi.fn().mockResolvedValue([]) },
    printingDesk: { listDeskPrintings: vi.fn().mockResolvedValue([]) },
    adminEvents: { printingIdsCreatedBy: vi.fn().mockResolvedValue([]) },
  };
}

describe("buildWorkspaceUploads", () => {
  const differences = [
    diff("a", { might: 4 }),
    diff("b", { might: 4 }),
    diff("c", { might: 4 }, "hidden-source"),
    diff("d", { might: 4 }, "hidden-source"),
  ];

  it("returns every provider with its open items and repeated difference to an admin", async () => {
    const response = await buildWorkspaceUploads(
      makeRepos(differences) as unknown as WorkspaceRepos,
      { access: { isAdmin: true, sections: [] }, userId: "admin-1", now: NOW },
    );
    expect(response.sources.map((source) => source.provider)).toEqual(["gallery", "hidden-source"]);
    expect(response.sources[0]).toMatchObject({
      open: 2,
      repeatedDifference: { field: "might", value: "4", count: 2 },
    });
  });

  it("limits a card-review holder to providers helpers can review", async () => {
    const response = await buildWorkspaceUploads(
      makeRepos(differences) as unknown as WorkspaceRepos,
      { access: { isAdmin: false, sections: ["card-review"] }, userId: "helper-1", now: NOW },
    );
    expect(response.sources.map((source) => source.provider)).toEqual(["gallery"]);
  });
});
