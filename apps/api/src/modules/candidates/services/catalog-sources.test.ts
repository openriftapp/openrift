import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogSourceRow } from "../repositories/candidate-cards-catalog-list.js";
import type { CatalogSourcesRepos } from "./catalog-sources.js";
import { buildCatalogSources } from "./catalog-sources.js";

function createRepos(overrides: {
  sources?: CatalogSourceRow[];
  pending?: { provider: string }[];
  groups?: { provider: string }[];
}): CatalogSourcesRepos {
  return {
    candidateCards: {
      listCatalogSourceRows: vi.fn().mockResolvedValue(overrides.sources ?? []),
      listSourceReviewGroups: vi.fn().mockResolvedValue(overrides.groups ?? []),
    },
    cardSubmissions: {
      pendingReviewQueueRows: vi.fn().mockResolvedValue(overrides.pending ?? []),
    },
  } as unknown as CatalogSourcesRepos;
}

function sourceRow(overrides: Partial<CatalogSourceRow> = {}): CatalogSourceRow {
  return {
    provider: "playloltcg",
    rows: 12,
    printingRows: 30,
    isHidden: false,
    isFavorite: true,
    helperReviewable: false,
    sortOrder: 2,
    lastUploadedAt: new Date("2026-09-01T10:00:00Z"),
    ignoredCount: 4,
    uncheckedRows: 6,
    ...overrides,
  };
}

describe("buildCatalogSources", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("always returns the contributors row first, with zeroes when nothing was submitted", async () => {
    const result = await buildCatalogSources(createRepos({}), null);

    expect(result.sources).toEqual([
      {
        provider: "usersubmission",
        kind: "contributors",
        rows: 0,
        printingRows: 0,
        inReview: 0,
        isHidden: false,
        isFavorite: false,
        helperReviewable: false,
        sortOrder: 0,
        lastUploadedAt: null,
        ignoredCount: 0,
        uncheckedRows: 0,
      },
    ]);
  });

  it("keeps the contributors row first even when the repository sorts it last", async () => {
    const repos = createRepos({
      sources: [
        sourceRow(),
        sourceRow({ provider: "usersubmission", sortOrder: 9, rows: 3, isFavorite: false }),
      ],
    });

    const result = await buildCatalogSources(repos, null);

    expect(result.sources.map((source) => source.provider)).toEqual([
      "usersubmission",
      "playloltcg",
    ]);
    expect(result.sources[0]).toMatchObject({ kind: "contributors", rows: 3, sortOrder: 9 });
    expect(result.sources[1]?.kind).toBe("upload");
  });

  it("maps the provider settings and the last upload timestamp", async () => {
    const result = await buildCatalogSources(createRepos({ sources: [sourceRow()] }), null);

    expect(result.sources[1]).toEqual({
      provider: "playloltcg",
      kind: "upload",
      rows: 12,
      printingRows: 30,
      inReview: 0,
      isHidden: false,
      isFavorite: true,
      helperReviewable: false,
      sortOrder: 2,
      lastUploadedAt: "2026-09-01T10:00:00.000Z",
      ignoredCount: 4,
      uncheckedRows: 6,
    });
  });

  it("counts queue items per provider across submissions and source groups", async () => {
    const repos = createRepos({
      sources: [sourceRow(), sourceRow({ provider: "gallery" })],
      pending: [{ provider: "usersubmission" }, { provider: "usersubmission" }],
      groups: [
        { provider: "playloltcg" },
        { provider: "playloltcg" },
        { provider: "playloltcg" },
        { provider: "gallery" },
      ],
    });

    const result = await buildCatalogSources(repos, null);
    const byProvider = new Map(result.sources.map((source) => [source.provider, source.inReview]));

    expect(byProvider.get("usersubmission")).toBe(2);
    expect(byProvider.get("playloltcg")).toBe(3);
    expect(byProvider.get("gallery")).toBe(1);
  });

  it("shows a grant holder only helper-reviewable providers plus contributors", async () => {
    const repos = createRepos({
      sources: [sourceRow(), sourceRow({ provider: "gallery", helperReviewable: true })],
    });

    const result = await buildCatalogSources(repos, new Set(["gallery"]));

    expect(result.sources.map((source) => source.provider)).toEqual(["usersubmission", "gallery"]);
  });

  it("zeroes the contributors counters when the grant excludes contributors", async () => {
    const repos = createRepos({
      sources: [
        sourceRow({
          provider: "usersubmission",
          rows: 7,
          printingRows: 19,
          ignoredCount: 3,
          isFavorite: true,
          sortOrder: 1,
        }),
      ],
      pending: [{ provider: "usersubmission" }, { provider: "usersubmission" }],
    });

    const result = await buildCatalogSources(repos, new Set(["gallery"]));

    expect(result.sources[0]).toEqual({
      provider: "usersubmission",
      kind: "contributors",
      rows: 0,
      printingRows: 0,
      inReview: 0,
      isHidden: false,
      isFavorite: true,
      helperReviewable: false,
      sortOrder: 1,
      lastUploadedAt: null,
      ignoredCount: 0,
      uncheckedRows: 0,
    });
  });

  it("keeps the contributors counters when the grant includes contributors", async () => {
    const repos = createRepos({
      sources: [sourceRow({ provider: "usersubmission", rows: 7 })],
      pending: [{ provider: "usersubmission" }],
    });

    const result = await buildCatalogSources(repos, new Set(["usersubmission"]));

    expect(result.sources[0]).toMatchObject({ rows: 7, inReview: 1 });
  });

  it("ignores queue items from providers outside the grant", async () => {
    const repos = createRepos({
      sources: [sourceRow({ provider: "gallery", helperReviewable: true })],
      groups: [{ provider: "gallery" }, { provider: "playloltcg" }],
    });

    const result = await buildCatalogSources(repos, new Set(["gallery"]));

    expect(result.sources.map((source) => source.inReview)).toEqual([0, 1]);
  });
});
