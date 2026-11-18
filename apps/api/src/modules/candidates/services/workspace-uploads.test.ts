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
  it("sums card and printing counts per upload", () => {
    const response = toWorkspaceUploads([UPLOAD], []);
    expect(response.sources).toEqual([
      {
        provider: "gallery",
        label: "gallery",
        uploadedAt: T2.toISOString(),
        newCards: 2,
        newPrintings: 5,
        updates: 7,
        removed: 3,
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
    );
    expect(response.sources.map((source) => source.provider)).toEqual(["fresh", "old"]);
    expect(response.sources[0]).toMatchObject({ newCards: 0 });
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
      { access: { isAdmin: true, sections: [] } },
    );
    expect(response.sources.map((source) => source.provider)).toEqual(["gallery", "hidden-source"]);
    expect(response.sources[0]).toMatchObject({
      repeatedDifference: { field: "might", value: "4", count: 2 },
    });
  });

  it("limits a card-review holder to providers helpers can review", async () => {
    const response = await buildWorkspaceUploads(
      makeRepos(differences) as unknown as WorkspaceRepos,
      { access: { isAdmin: false, sections: ["card-review"] } },
    );
    expect(response.sources.map((source) => source.provider)).toEqual(["gallery"]);
  });

  it("reads no queue sources, so a write's refetch builds the queue once", async () => {
    const repos = makeRepos(differences);
    await buildWorkspaceUploads(repos as unknown as WorkspaceRepos, {
      access: { isAdmin: true, sections: [] },
    });
    expect(repos.workspaceQueue.uncheckedLinkedPrintings).not.toHaveBeenCalled();
    expect(repos.cardSubmissions.pendingReviewQueueRows).not.toHaveBeenCalled();
    expect(repos.workspaceQueue.uncheckedCardDifferences).toHaveBeenCalledOnce();
  });
});
