/* oxlint-disable
   no-empty-function,
   unicorn/no-useless-undefined
   -- test file: mocks require empty fns and explicit undefined */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildExport } from "./candidate-export.js";

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
describe("buildExport", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns empty array when no cards exist", async () => {
    const repo = createMockRepo();
    const result = await buildExport(repo);
    expect(result).toEqual([]);
  });

  it("maps card fields to snake_case export format", async () => {
    const repo = createMockRepo({
      exportCards: vi.fn().mockResolvedValue([
        {
          id: "card-1",
          slug: "OGN-001",
          name: "Fireball",
          type: "spell",
          types: ["spell"],
          superTypes: [],
          domains: ["fury"],
          might: 3,
          energy: 2,
          power: null,
          mightBonus: null,
          tags: ["burn"],
        },
      ]),
      exportPrintings: vi.fn().mockResolvedValue([]),
      exportCardErrata: vi.fn().mockResolvedValue([
        {
          cardId: "card-1",
          correctedRulesText: "Deal damage",
          correctedEffectText: null,
        },
      ]),
    });

    const result = await buildExport(repo);

    expect(result).toHaveLength(1);
    expect(result[0]!.card).toEqual({
      name: "Fireball",
      types: ["spell"],
      super_types: [],
      domains: ["fury"],
      might: 3,
      energy: 2,
      power: null,
      might_bonus: null,
      rules_text: "Deal damage",
      effect_text: null,
      tags: ["burn"],
      short_code: "OGN-001",
      external_id: "card-1",
      extra_data: null,
    });
  });

  it("maps printings to snake_case with image_url preference", async () => {
    const repo = createMockRepo({
      exportCards: vi.fn().mockResolvedValue([
        {
          id: "card-1",
          slug: "OGN-001",
          name: "Fireball",
          type: "spell",
          types: ["spell"],
          superTypes: [],
          domains: ["fury"],
          might: 3,
          energy: 2,
          power: null,
          mightBonus: null,
          tags: [],
        },
      ]),
      exportPrintings: vi.fn().mockResolvedValue([
        {
          id: "p-1",
          cardId: "card-1",
          shortCode: "OGN-001",
          setSlug: "origin",
          setName: "Origin Set",
          rarity: "rare",
          artVariant: "normal",
          isSigned: false,
          finish: "normal",
          artist: "Jane Doe",
          publicCode: "001",
          printedRulesText: "Deal damage",
          printedEffectText: null,
          flavorText: "Burn it",
          originalUrl: "http://orig.com/img.jpg",
          rehostedUrl: null,
          imageId: null,
        },
      ]),
    });

    const result = await buildExport(repo);

    expect(result[0]!.printings).toHaveLength(1);
    expect(result[0]!.printings[0]!.image_url).toBe("http://orig.com/img.jpg");
    expect(result[0]!.printings[0]!.extra_data).toBeNull();
  });

  it("exports marker_slugs and size for the canonical reference", async () => {
    const repo = createMockRepo({
      exportCards: vi.fn().mockResolvedValue([
        {
          id: "card-1",
          slug: "OGN-066",
          name: "Ahri",
          type: "unit",
          types: ["unit"],
          superTypes: [],
          domains: ["calm"],
          might: 3,
          energy: 2,
          power: null,
          mightBonus: null,
          tags: [],
        },
      ]),
      exportPrintings: vi.fn().mockResolvedValue([
        {
          id: "p-1",
          cardId: "card-1",
          shortCode: "OGN-066",
          setSlug: "ogn",
          setName: "Origins",
          rarity: "rare",
          artVariant: "normal",
          isSigned: false,
          markerSlugs: ["launch-exclusive"],
          size: "standard",
          finish: "foil",
          artist: "Jane Doe",
          publicCode: "066",
          printedRulesText: null,
          printedEffectText: null,
          flavorText: null,
          originalUrl: null,
          rehostedUrl: null,
          imageId: null,
        },
      ]),
    });

    const result = await buildExport(repo);

    expect(result[0]!.printings[0]!.marker_slugs).toEqual(["launch-exclusive"]);
    expect(result[0]!.printings[0]!.size).toBe("standard");
  });

  it("exports printed_year so it round-trips back through the upload", async () => {
    const repo = createMockRepo({
      exportCards: vi.fn().mockResolvedValue([
        {
          id: "card-1",
          slug: "OGN-001",
          name: "Fireball",
          type: "spell",
          types: ["spell"],
          superTypes: [],
          domains: ["fury"],
          might: null,
          energy: 2,
          power: null,
          mightBonus: null,
          tags: [],
        },
      ]),
      exportPrintings: vi.fn().mockResolvedValue([
        {
          id: "p-1",
          cardId: "card-1",
          shortCode: "OGN-001",
          setSlug: "ogn",
          setName: "Origins",
          rarity: "rare",
          artVariant: "normal",
          isSigned: false,
          finish: "normal",
          artist: "Jane Doe",
          publicCode: "001",
          printedRulesText: null,
          printedEffectText: null,
          flavorText: null,
          printedYear: 2025,
          originalUrl: null,
          rehostedUrl: null,
          imageId: null,
        },
      ]),
    });

    const result = await buildExport(repo);

    expect(result[0]!.printings[0]!.printed_year).toBe(2025);
  });

  it("prefers originalUrl over rehostedUrl for image_url", async () => {
    const repo = createMockRepo({
      exportCards: vi.fn().mockResolvedValue([
        {
          id: "card-1",
          slug: "OGN-001",
          name: "X",
          type: "unit",
          types: ["unit"],
          superTypes: [],
          domains: ["fury"],
          might: 1,
          energy: 1,
          power: 1,
          mightBonus: null,
          tags: [],
        },
      ]),
      exportPrintings: vi.fn().mockResolvedValue([
        {
          id: "p-1",
          cardId: "card-1",
          shortCode: "OGN-001",
          setSlug: "origin",
          setName: "Origin",
          rarity: "common",
          artVariant: "normal",
          isSigned: false,
          finish: "normal",
          artist: "A",
          publicCode: "001",
          printedRulesText: null,
          printedEffectText: null,
          flavorText: null,
          originalUrl: "http://orig.com",
          rehostedUrl: "http://rehost.com",
          imageId: null,
        },
      ]),
    });

    const result = await buildExport(repo);
    expect(result[0]!.printings[0]!.image_url).toBe("http://orig.com");
  });

  it("falls back to rehostedUrl when originalUrl is null", async () => {
    const repo = createMockRepo({
      exportCards: vi.fn().mockResolvedValue([
        {
          id: "card-1",
          slug: "OGN-001",
          name: "X",
          type: "unit",
          types: ["unit"],
          superTypes: [],
          domains: ["fury"],
          might: 1,
          energy: 1,
          power: 1,
          mightBonus: null,
          tags: [],
        },
      ]),
      exportPrintings: vi.fn().mockResolvedValue([
        {
          id: "p-1",
          cardId: "card-1",
          shortCode: "OGN-001",
          setSlug: "origin",
          setName: "Origin",
          rarity: "common",
          artVariant: "normal",
          isSigned: false,
          finish: "normal",
          artist: "A",
          publicCode: "001",
          printedRulesText: null,
          printedEffectText: null,
          flavorText: null,
          originalUrl: null,
          rehostedUrl: "http://rehost.com",
          imageId: null,
        },
      ]),
    });

    const result = await buildExport(repo);
    expect(result[0]!.printings[0]!.image_url).toBe("http://rehost.com");
  });

  it("returns null image_url when both originalUrl and rehostedUrl are null", async () => {
    const repo = createMockRepo({
      exportCards: vi.fn().mockResolvedValue([
        {
          id: "card-1",
          slug: "X",
          name: "X",
          type: "unit",
          types: ["unit"],
          superTypes: [],
          domains: ["fury"],
          might: 1,
          energy: 1,
          power: 1,
          mightBonus: null,
          tags: [],
        },
      ]),
      exportPrintings: vi.fn().mockResolvedValue([
        {
          id: "p-1",
          cardId: "card-1",
          shortCode: "X-001",
          setSlug: "x",
          setName: "X",
          rarity: "common",
          artVariant: "normal",
          isSigned: false,
          finish: "normal",
          artist: "A",
          publicCode: "001",
          printedRulesText: null,
          printedEffectText: null,
          flavorText: null,
          originalUrl: null,
          rehostedUrl: null,
          imageId: null,
        },
      ]),
    });

    const result = await buildExport(repo);
    expect(result[0]!.printings[0]!.image_url).toBeNull();
  });

  it("includes imageId in extra_data when present", async () => {
    const repo = createMockRepo({
      exportCards: vi.fn().mockResolvedValue([
        {
          id: "card-1",
          slug: "X",
          name: "X",
          type: "unit",
          types: ["unit"],
          superTypes: [],
          domains: ["fury"],
          might: 1,
          energy: 1,
          power: 1,
          mightBonus: null,
          tags: [],
        },
      ]),
      exportPrintings: vi.fn().mockResolvedValue([
        {
          id: "p-1",
          cardId: "card-1",
          shortCode: "X-001",
          setSlug: "x",
          setName: "X",
          rarity: "common",
          artVariant: "normal",
          isSigned: false,
          finish: "normal",
          artist: "A",
          publicCode: "001",
          printedRulesText: null,
          printedEffectText: null,
          flavorText: null,
          originalUrl: null,
          rehostedUrl: null,
          imageId: "img-123",
        },
      ]),
    });

    const result = await buildExport(repo);
    expect(result[0]!.printings[0]!.extra_data).toEqual({ image_id: "img-123" });
  });

  it("groups printings by card id", async () => {
    const repo = createMockRepo({
      exportCards: vi.fn().mockResolvedValue([
        {
          id: "card-1",
          slug: "C1",
          name: "C1",
          type: "unit",
          types: ["unit"],
          superTypes: [],
          domains: ["fury"],
          might: 1,
          energy: 1,
          power: null,
          mightBonus: null,
          tags: [],
        },
        {
          id: "card-2",
          slug: "C2",
          name: "C2",
          type: "spell",
          types: ["spell"],
          superTypes: [],
          domains: ["calm"],
          might: null,
          energy: 2,
          power: null,
          mightBonus: null,
          tags: [],
        },
      ]),
      exportPrintings: vi.fn().mockResolvedValue([
        {
          id: "p-1",
          cardId: "card-1",
          shortCode: "C1-001",
          setSlug: "s",
          setName: "S",
          rarity: "common",
          artVariant: "normal",
          isSigned: false,
          finish: "normal",
          artist: "A",
          publicCode: "001",
          printedRulesText: null,
          printedEffectText: null,
          flavorText: null,
          originalUrl: null,
          rehostedUrl: null,
          imageId: null,
        },
        {
          id: "p-2",
          cardId: "card-1",
          shortCode: "C1-002",
          setSlug: "s",
          setName: "S",
          rarity: "common",
          artVariant: "normal",
          isSigned: false,
          finish: "foil",
          artist: "A",
          publicCode: "002",
          printedRulesText: null,
          printedEffectText: null,
          flavorText: null,
          originalUrl: null,
          rehostedUrl: null,
          imageId: null,
        },
      ]),
    });

    const result = await buildExport(repo);

    expect(result[0]!.printings).toHaveLength(2);
    expect(result[1]!.printings).toHaveLength(0);
  });
});
