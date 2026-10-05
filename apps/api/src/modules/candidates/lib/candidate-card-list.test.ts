/* oxlint-disable
   no-empty-function,
   unicorn/no-useless-undefined
   -- test file: mocks require empty fns and explicit undefined */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildCandidateCardList } from "./candidate-card-list.js";

function createMockRepo(overrides: Record<string, unknown> = {}) {
  return {
    listCardsForSourceList: vi.fn().mockResolvedValue([]),
    listCandidateCardsForSourceList: vi.fn().mockResolvedValue([]),
    listPrintingsForSourceList: vi.fn().mockResolvedValue([]),
    listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([]),
    listAliasesForSourceList: vi.fn().mockResolvedValue([]),
    listPendingSubmissionCandidateIds: vi.fn().mockResolvedValue([]),
    exportCards: vi.fn().mockResolvedValue([]),
    exportPrintings: vi.fn().mockResolvedValue([]),
    exportCardErrata: vi.fn().mockResolvedValue([]),
    cardForDetailBySlug: vi.fn().mockResolvedValue(undefined),
    cardErrataForDetail: vi.fn().mockResolvedValue(null),
    cardNameAliases: vi.fn().mockResolvedValue([]),
    candidateCardsForDetail: vi.fn().mockResolvedValue([]),
    candidatePrintingsForDetail: vi.fn().mockResolvedValue([]),
    printingsForDetail: vi.fn().mockResolvedValue([]),
    setInfoByIds: vi.fn().mockResolvedValue([]),
    setPrintedTotalBySlugs: vi.fn().mockResolvedValue([]),
    markerSlugsByIds: vi.fn().mockResolvedValue([]),
    distributionChannelSlugsForPrintings: vi.fn().mockResolvedValue([]),
    printingImagesForDetail: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as any;
}
describe("buildCandidateCardList", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns empty array when no cards or candidates exist", async () => {
    const repo = createMockRepo();
    const result = await buildCandidateCardList(repo, new Set(["gallery"]));
    expect(result).toEqual([]);
  });

  it("returns cards with matched candidate groups", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi
        .fn()
        .mockResolvedValue([
          { id: "card-1", slug: "fireball", name: "Fireball", normName: "fireball" },
        ]),
      listCandidateCardsForSourceList: vi.fn().mockResolvedValue([
        {
          id: "cc-1",
          normName: "fireball",
          name: "Fireball",
          provider: "gallery",
          checkedAt: null,
        },
      ]),
      listPrintingsForSourceList: vi
        .fn()
        .mockResolvedValue([{ cardId: "card-1", shortCode: "OGN-001", language: "EN" }]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listAliasesForSourceList: vi.fn().mockResolvedValue([]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));

    expect(result).toHaveLength(1);
    expect(result[0]!.cardSlug).toBe("fireball");
    expect(result[0]!.name).toBe("Fireball");
    expect(result[0]!.shortCodes).toEqual(["OGN-001"]);
    expect(result[0]!.candidateCount).toBe(1);
    expect(result[0]!.hasFavorite).toBe(true);
    expect(result[0]!.uncheckedCardCount).toBe(1);
  });

  it("matches candidate cards via aliases", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi
        .fn()
        .mockResolvedValue([
          { id: "card-1", slug: "fireball", name: "Fireball", normName: "fireball" },
        ]),
      listCandidateCardsForSourceList: vi
        .fn()
        .mockResolvedValue([
          { id: "cc-1", normName: "firebal", name: "Firebal", provider: "ocr", checkedAt: null },
        ]),
      listPrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listAliasesForSourceList: vi
        .fn()
        .mockResolvedValue([{ normName: "firebal", cardId: "card-1" }]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));

    expect(result).toHaveLength(1);
    expect(result[0]!.cardSlug).toBe("fireball");
    expect(result[0]!.candidateCount).toBe(1);
  });

  it("separates printings proposed by trusted sources from the rest", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi
        .fn()
        .mockResolvedValue([
          { id: "card-1", slug: "fireball", name: "Fireball", normName: "fireball" },
        ]),
      listCandidateCardsForSourceList: vi.fn().mockResolvedValue([
        {
          id: "cc-trusted",
          normName: "fireball",
          name: "Fireball",
          provider: "gallery",
          checkedAt: null,
        },
        {
          id: "cc-other",
          normName: "fireball",
          name: "Fireball",
          provider: "playloltcg",
          checkedAt: null,
        },
      ]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([
        { id: "cp-1", candidateCardId: "cc-trusted", shortCode: "OGN-001", printingId: null },
        { id: "cp-2", candidateCardId: "cc-other", shortCode: "OGN-002", printingId: null },
        { id: "cp-3", candidateCardId: "cc-other", shortCode: "OGN-003", printingId: null },
      ]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));

    expect(result[0]!.unlinkedPrintingCount).toBe(3);
    expect(result[0]!.unlinkedTrustedPrintingCount).toBe(1);
  });

  it("counts only submissions still waiting on an answer", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi
        .fn()
        .mockResolvedValue([
          { id: "card-1", slug: "fireball", name: "Fireball", normName: "fireball" },
        ]),
      listCandidateCardsForSourceList: vi.fn().mockResolvedValue([
        {
          id: "cc-1",
          normName: "fireball",
          name: "Fireball",
          provider: "usersubmission",
          checkedAt: null,
        },
        {
          id: "cc-2",
          normName: "fireball",
          name: "Fireball",
          provider: "usersubmission",
          checkedAt: null,
        },
      ]),
      listPendingSubmissionCandidateIds: vi.fn().mockResolvedValue([{ candidateCardId: "cc-1" }]),
    });

    const result = await buildCandidateCardList(repo, new Set(["usersubmission"]));

    expect(result[0]!.pendingSubmissions).toBe(1);
    expect(result[0]!.hasUserSubmission).toBe(true);
  });

  it("names only the trusted sources with something unchecked", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi
        .fn()
        .mockResolvedValue([
          { id: "card-1", slug: "fireball", name: "Fireball", normName: "fireball" },
        ]),
      listCandidateCardsForSourceList: vi.fn().mockResolvedValue([
        {
          id: "cc-1",
          normName: "fireball",
          name: "Fireball",
          provider: "gallery",
          checkedAt: null,
        },
        {
          id: "cc-2",
          normName: "fireball",
          name: "Fireball",
          provider: "ocr",
          checkedAt: new Date(),
        },
        {
          id: "cc-3",
          normName: "fireball",
          name: "Fireball",
          provider: "intake",
          checkedAt: new Date(),
        },
        {
          id: "cc-4",
          normName: "fireball",
          name: "Fireball",
          provider: "playloltcg",
          checkedAt: null,
        },
      ]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([
        { id: "cp-1", candidateCardId: "cc-2", shortCode: "OGN-001", checkedAt: null },
        { id: "cp-2", candidateCardId: "cc-3", shortCode: "OGN-002", checkedAt: new Date() },
      ]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery", "ocr", "intake"]));

    expect(result[0]!.uncheckedTrustedProviders).toEqual(["gallery", "ocr"]);
  });

  it("reports unmatched candidate groups with null cardSlug", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidateCardsForSourceList: vi.fn().mockResolvedValue([
        {
          id: "cc-1",
          normName: "newcard",
          name: "New Card",
          provider: "gallery",
          checkedAt: null,
        },
      ]),
      listPrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listAliasesForSourceList: vi.fn().mockResolvedValue([]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));

    expect(result).toHaveLength(1);
    expect(result[0]!.cardSlug).toBeNull();
    expect(result[0]!.name).toBe("New Card");
    expect(result[0]!.normalizedName).toBe("newcard");
  });

  it("keeps non-Latin candidate names in separate rows", async () => {
    const cjk = [
      { name: "影流之主", normName: "影流之主", shortCode: "VEN-189*" },
      { name: "沙漠皇帝", normName: "沙漠皇帝", shortCode: "VEN-191*" },
      { name: "德玛西亚之力", normName: "德玛西亚之力", shortCode: "VEN-193*" },
      { name: "祖安狂人", normName: "祖安狂人", shortCode: "VEN-197*" },
    ];
    const repo = createMockRepo({
      listCardsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidateCardsForSourceList: vi.fn().mockResolvedValue(
        cjk.map((c, i) => ({
          id: `cc-${i}`,
          normName: c.normName,
          name: c.name,
          provider: "gallery",
          checkedAt: null,
        })),
      ),
      listPrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listAliasesForSourceList: vi.fn().mockResolvedValue([]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));

    expect(result).toHaveLength(cjk.length);
    expect(result.map((r) => r.name).toSorted()).toEqual(cjk.map((c) => c.name).toSorted());
    for (const row of result) {
      expect(row.candidateCount).toBe(1);
      expect(row.normalizedName).not.toBe("");
    }
  });

  it("does not merge distinct names that both normalize to empty", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidateCardsForSourceList: vi.fn().mockResolvedValue([
        { id: "cc-1", normName: "", name: "!?!", provider: "gallery", checkedAt: null },
        { id: "cc-2", normName: "", name: "★☆", provider: "gallery", checkedAt: null },
      ]),
      listPrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listAliasesForSourceList: vi.fn().mockResolvedValue([]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name).toSorted()).toEqual(["!?!", "★☆"]);
    for (const row of result) {
      expect(row.normalizedName).toBe("");
      expect(row.candidateCount).toBe(1);
    }
  });

  it("still groups same-name candidates from different providers", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidateCardsForSourceList: vi.fn().mockResolvedValue([
        {
          id: "cc-1",
          normName: "影流之主",
          name: "影流之主",
          provider: "gallery",
          checkedAt: null,
        },
        { id: "cc-2", normName: "影流之主", name: "影流之主", provider: "ocr", checkedAt: null },
      ]),
      listPrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listAliasesForSourceList: vi.fn().mockResolvedValue([]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));

    expect(result).toHaveLength(1);
    expect(result[0]!.candidateCount).toBe(2);
  });

  it("counts unchecked printings across a candidate group", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi
        .fn()
        .mockResolvedValue([
          { id: "card-1", slug: "fireball", name: "Fireball", normName: "fireball" },
        ]),
      listCandidateCardsForSourceList: vi.fn().mockResolvedValue([
        {
          id: "cc-1",
          normName: "fireball",
          name: "Fireball",
          provider: "gallery",
          checkedAt: null,
        },
      ]),
      listPrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([
        { candidateCardId: "cc-1", shortCode: "OGN-001", checkedAt: null, printingId: null },
        {
          candidateCardId: "cc-1",
          shortCode: "OGN-002",
          checkedAt: new Date(),
          printingId: null,
        },
        {
          candidateCardId: "cc-1",
          shortCode: "OGN-003",
          checkedAt: null,
          printingId: "printing-1",
        },
      ]),
      listAliasesForSourceList: vi.fn().mockResolvedValue([]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));

    expect(result[0]!.uncheckedPrintingCount).toBe(2);
    expect(result[0]!.stagingShortCodes).toEqual(["OGN-001"]);
  });

  it("collects staging short codes only for unchecked unlinked candidate printings", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi
        .fn()
        .mockResolvedValue([{ id: "card-1", slug: "bolt", name: "Bolt", normName: "bolt" }]),
      listCandidateCardsForSourceList: vi
        .fn()
        .mockResolvedValue([
          { id: "cc-1", normName: "bolt", name: "Bolt", provider: "ocr", checkedAt: null },
        ]),
      listPrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([
        { candidateCardId: "cc-1", shortCode: "SFD-100", checkedAt: null, printingId: null },
        { candidateCardId: "cc-1", shortCode: "SFD-101", checkedAt: null, printingId: null },
        {
          candidateCardId: "cc-1",
          shortCode: "SFD-102",
          checkedAt: new Date(),
          printingId: null,
        },
      ]),
      listAliasesForSourceList: vi.fn().mockResolvedValue([]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));

    expect(result[0]!.stagingShortCodes).toEqual(["SFD-100", "SFD-101"]);
  });

  it("keeps staging short codes in repo order when merged across providers", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi
        .fn()
        .mockResolvedValue([{ id: "card-1", slug: "bolt", name: "Bolt", normName: "bolt" }]),
      listCandidateCardsForSourceList: vi.fn().mockResolvedValue([
        { id: "cc-1", normName: "bolt", name: "Bolt", provider: "ocr", checkedAt: null },
        { id: "cc-2", normName: "bolt", name: "Bolt", provider: "gallery", checkedAt: null },
      ]),
      listPrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([
        { candidateCardId: "cc-2", shortCode: "OGN-001", checkedAt: null, printingId: null },
        { candidateCardId: "cc-1", shortCode: "OGN-002", checkedAt: null, printingId: null },
        { candidateCardId: "cc-2", shortCode: "SFD-100", checkedAt: null, printingId: null },
        {
          candidateCardId: "cc-1",
          shortCode: "OGN-001",
          checkedAt: null,
          printingId: null,
          language: "SC",
        },
      ]),
      listAliasesForSourceList: vi.fn().mockResolvedValue([]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));

    expect(result[0]!.stagingShortCodes).toEqual(["OGN-001", "OGN-002", "SFD-100", "OGN-001 [SC]"]);
  });

  it("merges multiple candidate groups from aliases and direct match", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi
        .fn()
        .mockResolvedValue([
          { id: "card-1", slug: "fireball", name: "Fireball", normName: "fireball" },
        ]),
      listCandidateCardsForSourceList: vi.fn().mockResolvedValue([
        {
          id: "cc-1",
          normName: "fireball",
          name: "Fireball",
          provider: "gallery",
          checkedAt: null,
        },
        { id: "cc-2", normName: "firebal", name: "Firebal", provider: "ocr", checkedAt: null },
      ]),
      listPrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listAliasesForSourceList: vi
        .fn()
        .mockResolvedValue([{ normName: "firebal", cardId: "card-1" }]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));

    expect(result).toHaveLength(1);
    expect(result[0]!.candidateCount).toBe(2);
  });

  it("returns suggestedCardSlug for unmatched entries matching card prefix", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi
        .fn()
        .mockResolvedValue([
          { id: "card-1", slug: "fireball", name: "Fireball", normName: "fireball" },
        ]),
      listCandidateCardsForSourceList: vi.fn().mockResolvedValue([
        {
          id: "cc-1",
          normName: "fireballultimate",
          name: "Fireball Ultimate",
          provider: "gallery",
          checkedAt: null,
        },
      ]),
      listPrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listAliasesForSourceList: vi.fn().mockResolvedValue([]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));

    expect(result).toHaveLength(2);
    const unmatched = result.find((r) => r.cardSlug === null);
    expect(unmatched?.suggestedCardSlug).toBe("fireball");
  });

  it("returns null suggestedCardSlug when no prefix match found", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi
        .fn()
        .mockResolvedValue([
          { id: "card-1", slug: "fireball", name: "Fireball", normName: "fireball" },
        ]),
      listCandidateCardsForSourceList: vi.fn().mockResolvedValue([
        {
          id: "cc-1",
          normName: "zzznomatch",
          name: "No Match",
          provider: "gallery",
          checkedAt: null,
        },
      ]),
      listPrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listAliasesForSourceList: vi.fn().mockResolvedValue([]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));
    const unmatched = result.find((r) => r.cardSlug === null);
    expect(unmatched?.suggestedCardSlug).toBeNull();
  });

  it("prefers longest normName prefix for suggested card slug", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi.fn().mockResolvedValue([
        { id: "card-1", slug: "fire", name: "Fire", normName: "fire" },
        { id: "card-2", slug: "fireball", name: "Fireball", normName: "fireball" },
      ]),
      listCandidateCardsForSourceList: vi.fn().mockResolvedValue([
        {
          id: "cc-1",
          normName: "fireballultimate",
          name: "Fireball Ultimate",
          provider: "gallery",
          checkedAt: null,
        },
      ]),
      listPrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listAliasesForSourceList: vi.fn().mockResolvedValue([]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));
    const unmatched = result.find((r) => r.cardSlug === null);
    expect(unmatched?.suggestedCardSlug).toBe("fireball");
  });

  it("handles multiple printings on the same card", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi
        .fn()
        .mockResolvedValue([{ id: "card-1", slug: "bolt", name: "Bolt", normName: "bolt" }]),
      listCandidateCardsForSourceList: vi.fn().mockResolvedValue([]),
      listPrintingsForSourceList: vi.fn().mockResolvedValue([
        { cardId: "card-1", shortCode: "OGN-001", language: "EN" },
        { cardId: "card-1", shortCode: "OGN-002", language: "EN" },
      ]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listAliasesForSourceList: vi.fn().mockResolvedValue([]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));

    expect(result[0]!.shortCodes).toEqual(["OGN-001", "OGN-002"]);
    expect(result[0]!.candidateCount).toBe(0);
    expect(result[0]!.hasFavorite).toBe(false);
  });

  it("reports hasFavorite false when no favorite provider", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi
        .fn()
        .mockResolvedValue([{ id: "card-1", slug: "bolt", name: "Bolt", normName: "bolt" }]),
      listCandidateCardsForSourceList: vi
        .fn()
        .mockResolvedValue([
          { id: "cc-1", normName: "bolt", name: "Bolt", provider: "ocr", checkedAt: null },
        ]),
      listPrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listAliasesForSourceList: vi.fn().mockResolvedValue([]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));
    expect(result[0]!.hasFavorite).toBe(false);
  });

  it("counts unchecked candidate cards only from favorite providers", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi
        .fn()
        .mockResolvedValue([{ id: "card-1", slug: "bolt", name: "Bolt", normName: "bolt" }]),
      listCandidateCardsForSourceList: vi.fn().mockResolvedValue([
        { id: "cc-1", normName: "bolt", name: "Bolt", provider: "gallery", checkedAt: new Date() },
        { id: "cc-2", normName: "bolt", name: "Bolt", provider: "ocr", checkedAt: null },
      ]),
      listPrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listAliasesForSourceList: vi.fn().mockResolvedValue([]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));
    expect(result[0]!.uncheckedCardCount).toBe(0);

    const result2 = await buildCandidateCardList(repo, new Set(["gallery", "ocr"]));
    expect(result2[0]!.uncheckedCardCount).toBe(1);
  });

  it("handles card with no candidate group (null group)", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi
        .fn()
        .mockResolvedValue([{ id: "card-1", slug: "bolt", name: "Bolt", normName: "bolt" }]),
      listCandidateCardsForSourceList: vi.fn().mockResolvedValue([]),
      listPrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listAliasesForSourceList: vi.fn().mockResolvedValue([]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));

    expect(result[0]!.candidateCount).toBe(0);
    expect(result[0]!.stagingShortCodes).toEqual([]);
    expect(result[0]!.favoriteStagingShortCodes).toEqual([]);
    expect(result[0]!.uncheckedCardCount).toBe(0);
    expect(result[0]!.uncheckedPrintingCount).toBe(0);
    expect(result[0]!.unlinkedPrintingCount).toBe(0);
    expect(result[0]!.hasFavorite).toBe(false);
    expect(result[0]!.suggestedCardSlug).toBeNull();
  });

  it("counts every unlinked candidate printing, checked or not, from any provider", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi
        .fn()
        .mockResolvedValue([{ id: "card-1", slug: "bolt", name: "Bolt", normName: "bolt" }]),
      listCandidateCardsForSourceList: vi.fn().mockResolvedValue([
        { id: "cc-fav", normName: "bolt", name: "Bolt", provider: "gallery", checkedAt: null },
        { id: "cc-other", normName: "bolt", name: "Bolt", provider: "ocr", checkedAt: null },
      ]),
      listPrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([
        { candidateCardId: "cc-fav", shortCode: "OGN-001", checkedAt: null, printingId: null },
        {
          candidateCardId: "cc-fav",
          shortCode: "OGN-002",
          checkedAt: new Date(),
          printingId: null,
        },
        { candidateCardId: "cc-other", shortCode: "OGN-003", checkedAt: null, printingId: null },
        { candidateCardId: "cc-fav", shortCode: "OGN-004", checkedAt: null, printingId: "p-1" },
      ]),
      listAliasesForSourceList: vi.fn().mockResolvedValue([]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));

    expect(result[0]!.favoriteStagingShortCodes).toEqual(["OGN-001"]);
    expect(result[0]!.unlinkedPrintingCount).toBe(3);
  });

  it("reports no unlinked printings when every candidate printing is accepted", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi
        .fn()
        .mockResolvedValue([{ id: "card-1", slug: "bolt", name: "Bolt", normName: "bolt" }]),
      listCandidateCardsForSourceList: vi
        .fn()
        .mockResolvedValue([
          { id: "cc-1", normName: "bolt", name: "Bolt", provider: "gallery", checkedAt: null },
        ]),
      listPrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidatePrintingsForSourceList: vi
        .fn()
        .mockResolvedValue([
          { candidateCardId: "cc-1", shortCode: "OGN-001", checkedAt: null, printingId: "p-1" },
        ]),
      listAliasesForSourceList: vi.fn().mockResolvedValue([]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));

    expect(result[0]!.unlinkedPrintingCount).toBe(0);
  });

  it("counts unlinked candidate printings on unmatched rows too", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidateCardsForSourceList: vi
        .fn()
        .mockResolvedValue([
          { id: "cc-1", normName: "bolt", name: "Bolt", provider: "gallery", checkedAt: null },
        ]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([
        { candidateCardId: "cc-1", shortCode: "OGN-001", checkedAt: null, printingId: null },
        {
          candidateCardId: "cc-1",
          shortCode: "OGN-002",
          checkedAt: new Date(),
          printingId: null,
        },
      ]),
      listAliasesForSourceList: vi.fn().mockResolvedValue([]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));

    expect(result[0]!.cardSlug).toBeNull();
    expect(result[0]!.unlinkedPrintingCount).toBe(2);
  });

  it("favoriteStagingShortCodes includes only codes from favorite providers", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi
        .fn()
        .mockResolvedValue([{ id: "card-1", slug: "bolt", name: "Bolt", normName: "bolt" }]),
      listCandidateCardsForSourceList: vi.fn().mockResolvedValue([
        { id: "cc-fav", normName: "bolt", name: "Bolt", provider: "gallery", checkedAt: null },
        { id: "cc-other", normName: "bolt", name: "Bolt", provider: "ocr", checkedAt: null },
      ]),
      listPrintingsForSourceList: vi.fn().mockResolvedValue([]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([
        { candidateCardId: "cc-fav", shortCode: "OGN-001", checkedAt: null, printingId: null },
        { candidateCardId: "cc-other", shortCode: "OGN-002", checkedAt: null, printingId: null },
      ]),
      listAliasesForSourceList: vi.fn().mockResolvedValue([]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));

    expect(result[0]!.stagingShortCodes).toEqual(["OGN-001", "OGN-002"]);
    expect(result[0]!.favoriteStagingShortCodes).toEqual(["OGN-001"]);
  });

  it("derives setSlugs from a matched card's accepted printings", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi
        .fn()
        .mockResolvedValue([{ id: "card-1", slug: "bolt", name: "Bolt", normName: "bolt" }]),
      listPrintingsForSourceList: vi.fn().mockResolvedValue([
        { cardId: "card-1", shortCode: "OGN-001", language: "EN", setSlug: "ogn" },
        { cardId: "card-1", shortCode: "VEN-050", language: "EN", setSlug: "ven" },
      ]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));

    expect(result[0]!.setSlugs).toEqual(["ogn", "ven"]);
  });

  it("includes pending candidate-printing sets in an unmatched row's setSlugs", async () => {
    const repo = createMockRepo({
      listCandidateCardsForSourceList: vi.fn().mockResolvedValue([
        {
          id: "cc-1",
          normName: "newcard",
          name: "New Card",
          provider: "gallery",
          checkedAt: null,
        },
      ]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([
        {
          candidateCardId: "cc-1",
          shortCode: "VEN-101",
          checkedAt: null,
          printingId: null,
          setId: "ven",
        },
      ]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));
    const unmatched = result.find((r) => r.cardSlug === null);
    expect(unmatched?.setSlugs).toEqual(["ven"]);
  });

  it("unions accepted and pending candidate sets on a matched card, deduped and sorted", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi
        .fn()
        .mockResolvedValue([{ id: "card-1", slug: "bolt", name: "Bolt", normName: "bolt" }]),
      listCandidateCardsForSourceList: vi
        .fn()
        .mockResolvedValue([
          { id: "cc-1", normName: "bolt", name: "Bolt", provider: "gallery", checkedAt: null },
        ]),
      listPrintingsForSourceList: vi
        .fn()
        .mockResolvedValue([
          { cardId: "card-1", shortCode: "OGN-001", language: "EN", setSlug: "ogn" },
        ]),
      listCandidatePrintingsForSourceList: vi.fn().mockResolvedValue([
        {
          candidateCardId: "cc-1",
          shortCode: "VEN-050",
          checkedAt: null,
          printingId: null,
          setId: "ven",
        },
        {
          candidateCardId: "cc-1",
          shortCode: "OGN-001",
          checkedAt: null,
          printingId: null,
          setId: "ogn",
        },
      ]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));

    expect(result[0]!.setSlugs).toEqual(["ogn", "ven"]);
  });

  it("leaves setSlugs empty when no printing carries a set", async () => {
    const repo = createMockRepo({
      listCardsForSourceList: vi
        .fn()
        .mockResolvedValue([{ id: "card-1", slug: "bolt", name: "Bolt", normName: "bolt" }]),
      listPrintingsForSourceList: vi
        .fn()
        .mockResolvedValue([
          { cardId: "card-1", shortCode: "OGN-001", language: "EN", setSlug: null },
        ]),
    });

    const result = await buildCandidateCardList(repo, new Set(["gallery"]));
    expect(result[0]!.setSlugs).toEqual([]);
  });
});
