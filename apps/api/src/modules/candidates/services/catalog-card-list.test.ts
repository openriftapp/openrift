import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogCardListRow } from "../repositories/candidate-cards-catalog-list.js";
import type { CatalogCardListRepos } from "./catalog-card-list.js";
import { buildCatalogCardList } from "./catalog-card-list.js";

function createRepos(rows: CatalogCardListRow[]): CatalogCardListRepos {
  return {
    candidateCards: {
      listCatalogCardRows: vi.fn().mockResolvedValue(rows),
    },
  } as unknown as CatalogCardListRepos;
}

function row(overrides: Partial<CatalogCardListRow> = {}): CatalogCardListRow {
  return {
    cardSlug: "jinx",
    name: "Jinx",
    normName: "jinx",
    firstSetSlug: "OGN",
    firstSetName: "Origins",
    setSlugs: ["OGN"],
    shortCodes: ["OGN-001", "OGN-001 [FR]"],
    printingCount: 2,
    printingsWithoutImage: 0,
    proposals: 0,
    newPrintings: 0,
    uncheckedTrustedProviders: [],
    updatedAt: new Date("2026-09-01T10:00:00Z"),
    ...overrides,
  };
}

describe("buildCatalogCardList", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns an empty list with zero counts", async () => {
    const result = await buildCatalogCardList(createRepos([]), null);

    expect(result.rows).toEqual([]);
    expect(result.counts).toEqual({ all: 0, needsAttention: 0, drafts: 0 });
  });

  it("maps a quiet card row and marks it as not needing attention", async () => {
    const result = await buildCatalogCardList(createRepos([row()]), null);

    expect(result.rows).toEqual([
      {
        cardSlug: "jinx",
        name: "Jinx",
        normName: "jinx",
        firstSetSlug: "OGN",
        firstSetName: "Origins",
        setSlugs: ["OGN"],
        shortCodes: ["OGN-001", "OGN-001 [FR]"],
        printingCount: 2,
        printingsWithoutImage: 0,
        proposals: 0,
        newPrintings: 0,
        uncheckedTrustedProviders: [],
        needsAttention: false,
        updatedAt: "2026-09-01T10:00:00.000Z",
      },
    ]);
    expect(result.counts).toEqual({ all: 1, needsAttention: 0, drafts: 0 });
  });

  it.each([
    ["a pending proposal", { proposals: 1 }],
    ["a new printing", { newPrintings: 1 }],
    ["an unchecked trusted provider", { uncheckedTrustedProviders: ["gallery"] }],
    ["a printing without an image", { printingsWithoutImage: 1 }],
  ])("flags %s as needing attention", async (_label, overrides) => {
    const result = await buildCatalogCardList(createRepos([row(overrides)]), null);

    expect(result.rows[0]?.needsAttention).toBe(true);
    expect(result.counts).toEqual({ all: 1, needsAttention: 1, drafts: 0 });
  });

  it("counts drafts inside the total and flags a draft that needs attention", async () => {
    const draft = row({
      cardSlug: null,
      name: "Ekko, Unlisted",
      normName: "ekkounlisted",
      firstSetSlug: null,
      firstSetName: null,
      setSlugs: [],
      shortCodes: ["OGN-900"],
      printingCount: 0,
      newPrintings: 3,
    });

    const result = await buildCatalogCardList(createRepos([row(), draft]), null);

    expect(result.counts).toEqual({ all: 2, needsAttention: 1, drafts: 1 });
    expect(result.rows[1]).toMatchObject({
      cardSlug: null,
      needsAttention: true,
      printingCount: 0,
    });
  });

  it("passes a full admin's null scope straight through", async () => {
    const repos = createRepos([]);

    await buildCatalogCardList(repos, null);

    expect(repos.candidateCards.listCatalogCardRows).toHaveBeenCalledWith(null);
  });

  it("passes a grant holder's providers to the repository", async () => {
    const repos = createRepos([]);

    await buildCatalogCardList(repos, new Set(["playloltcg", "usersubmission"]));

    expect(repos.candidateCards.listCatalogCardRows).toHaveBeenCalledWith([
      "playloltcg",
      "usersubmission",
    ]);
  });
});
