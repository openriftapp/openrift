import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReviewQueueRepos } from "./review-queue.js";
import { buildReviewQueue } from "./review-queue.js";

function createRepos(overrides: {
  pending?: unknown[];
  groups?: unknown[];
  slugs?: { normName: string; slug: string }[];
}): ReviewQueueRepos {
  return {
    cardSubmissions: {
      pendingReviewQueueRows: vi.fn().mockResolvedValue(overrides.pending ?? []),
    },
    candidateCards: {
      listSourceReviewGroups: vi.fn().mockResolvedValue(overrides.groups ?? []),
      cardSlugsByNormNames: vi.fn().mockResolvedValue(overrides.slugs ?? []),
    },
  } as unknown as ReviewQueueRepos;
}

const submissionRow = {
  id: "sub-1",
  kind: "correction" as const,
  provider: "usersubmission",
  cardName: "Jinx",
  normName: "jinx",
  candidateCardId: "cc-1",
  submitterName: "Ekko Fan",
  note: "Artist is wrong",
  proposedDiff: ["card.energy", "printing.OGN-002|foil||EN.artist"],
  uncheckedPrintings: 2,
  newPrintings: 1,
  createdAt: new Date("2026-09-01T10:00:00Z"),
};

const sourceGroup = {
  provider: "playloltcg",
  normName: "yasuo",
  candidateCardId: "cc-9",
  cardName: "Yasuo",
  uncheckedCards: 2,
  uncheckedPrintings: 3,
  newPrintings: 1,
  createdAt: new Date("2026-08-20T08:00:00Z"),
};

describe("buildReviewQueue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns an empty queue when nothing is open", async () => {
    const result = await buildReviewQueue(createRepos({}), null);
    expect(result.items).toEqual([]);
    expect(result.counts).toEqual({ open: 0, contributors: 0, sources: 0 });
  });

  it("maps a pending submission to a contributor item", async () => {
    const repos = createRepos({
      pending: [submissionRow],
      slugs: [{ normName: "jinx", slug: "jinx" }],
    });

    const result = await buildReviewQueue(repos, null);

    expect(result.items).toEqual([
      {
        id: "sub-1",
        kind: "correction",
        provider: "usersubmission",
        isContributor: true,
        submitterName: "Ekko Fan",
        cardName: "Jinx",
        normName: "jinx",
        cardSlug: "jinx",
        candidateCardId: "cc-1",
        note: "Artist is wrong",
        changedFields: 2,
        uncheckedPrintings: 2,
        newPrintings: 1,
        createdAt: "2026-09-01T10:00:00.000Z",
      },
    ]);
    expect(result.counts).toEqual({ open: 1, contributors: 1, sources: 0 });
  });

  it("leaves cardSlug null for a new-card submission with no live card", async () => {
    const repos = createRepos({
      pending: [{ ...submissionRow, kind: "new_card", proposedDiff: ["card.new"] }],
    });

    const result = await buildReviewQueue(repos, null);
    const [item] = result.items;
    expect(item?.cardSlug).toBeNull();
    expect(item?.kind).toBe("new_card");
    expect(item?.changedFields).toBe(1);
  });

  it("counts an unfavorited provider's group as a source item", async () => {
    const repos = createRepos({ groups: [sourceGroup] });

    const result = await buildReviewQueue(repos, null);

    expect(result.items).toEqual([
      {
        id: "playloltcg::yasuo",
        kind: "source",
        provider: "playloltcg",
        isContributor: false,
        submitterName: null,
        cardName: "Yasuo",
        normName: "yasuo",
        cardSlug: null,
        candidateCardId: "cc-9",
        note: null,
        changedFields: 2,
        uncheckedPrintings: 3,
        newPrintings: 1,
        createdAt: "2026-08-20T08:00:00.000Z",
      },
    ]);
    expect(result.counts).toEqual({ open: 1, contributors: 0, sources: 1 });
  });

  it("sorts oldest first across both kinds", async () => {
    const repos = createRepos({ pending: [submissionRow], groups: [sourceGroup] });

    const result = await buildReviewQueue(repos, null);

    expect(result.items.map((item) => item.id)).toEqual(["playloltcg::yasuo", "sub-1"]);
    expect(result.counts).toEqual({ open: 2, contributors: 1, sources: 1 });
  });

  it("filters both kinds to the granted providers", async () => {
    const repos = createRepos({ pending: [submissionRow], groups: [sourceGroup] });

    const result = await buildReviewQueue(repos, new Set(["playloltcg"]));

    expect(result.items.map((item) => item.provider)).toEqual(["playloltcg"]);
    expect(result.counts).toEqual({ open: 1, contributors: 0, sources: 1 });
  });

  it("resolves slugs only for the names left after scoping", async () => {
    const repos = createRepos({ pending: [submissionRow], groups: [sourceGroup] });

    await buildReviewQueue(repos, new Set(["usersubmission"]));

    expect(repos.candidateCards.cardSlugsByNormNames).toHaveBeenCalledWith(["jinx"]);
  });
});
