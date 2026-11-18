import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import {
  buildCardDetail,
  buildUnmatchedDetail,
} from "../../candidates/lib/candidate-card-detail.js";
import { buildCandidateCardList } from "../../candidates/lib/candidate-card-list.js";
import { adminCardQueriesRouter } from "./admin-cards-queries";

vi.mock("../../candidates/lib/candidate-card-list.js", () => ({
  buildCandidateCardList: vi.fn(),
}));
vi.mock("../../candidates/lib/candidate-card-detail.js", () => ({
  buildCardDetail: vi.fn(),
  buildUnmatchedDetail: vi.fn(),
}));

const mockBuildCandidateCardList = vi.mocked(buildCandidateCardList);
const mockBuildCandidateCardDetail = vi.mocked(buildCardDetail);
const mockBuildUnmatchedDetail = vi.mocked(buildUnmatchedDetail);

const mockCandidateCards = {};

const mockProviderSettings = {
  favoriteProviders: vi.fn().mockResolvedValue(new Set(["gallery"])),
};

const mockMarketplaceMapping = {
  variantsForCard: vi.fn().mockResolvedValue([]),
};

const USER_ID = "a0000000-0001-4000-a000-000000000001";

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: USER_ID } as never);
  c.set("adminAccess", { isAdmin: true, sections: [] });
  c.set("repos", {
    candidateCards: mockCandidateCards,
    providerSettings: mockProviderSettings,
    marketplaceMapping: mockMarketplaceMapping,
  } as never);
  await next();
});
registerRouterForTest(app, adminCardQueriesRouter);

describe("GET /api/admin/v1/cards (candidate list)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 200 with candidate card list", async () => {
    mockProviderSettings.favoriteProviders.mockResolvedValue(new Set(["gallery"]));
    const candidates = [
      {
        cardSlug: "fireball",
        name: "Fireball",
        normalizedName: "fireball",
        shortCodes: ["OGN-001"],
        stagingShortCodes: [],
        setSlugs: ["ogn"],
        candidateCount: 1,
        uncheckedCardCount: 0,
        uncheckedPrintingCount: 0,
        unlinkedPrintingCount: 0,
        unlinkedTrustedPrintingCount: 0,
        hasFavorite: true,
        favoriteStagingShortCodes: [],
        suggestedCardSlug: null,
        hasUserSubmission: false,
        pendingSubmissions: 0,
        uncheckedTrustedProviders: [],
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    ];
    mockBuildCandidateCardList.mockResolvedValue(candidates);

    const res = await app.request("/api/admin/v1/cards");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual(candidates);
    expect(mockBuildCandidateCardList).toHaveBeenCalledWith(
      mockCandidateCards,
      expect.any(Set),
      null,
    );
  });
});

describe("GET /api/admin/v1/cards/:cardSlug", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 200 with candidate card detail", async () => {
    const detail = {
      card: {
        id: "card-1",
        slug: "fireball",
        name: "Fireball",
        types: ["spell"],
        superTypes: [],
        domains: [],
        might: null,
        energy: null,
        power: null,
        mightBonus: null,
        maxCopiesOverride: null,
        additionalLegendCount: null,
        keywords: [],
        errata: [],
        tags: [],
        comment: null,
      },
      displayName: "Fireball",
      sources: [],
      printings: [],
      candidatePrintings: [],
      candidatePrintingGroups: [],
      expectedCardId: "OGN-001",
      printingImages: [],
      setTotals: {},
      marketplaceMappings: [],
    };
    mockBuildCandidateCardDetail.mockResolvedValue(detail);

    const res = await app.request("/api/admin/v1/cards/fireball");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.displayName).toBe("Fireball");
    expect(mockBuildCandidateCardDetail).toHaveBeenCalledWith(
      mockCandidateCards,
      mockMarketplaceMapping,
      "fireball",
      null,
    );
  });
});

describe("GET /api/admin/v1/cards/new/:name", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 200 with unmatched detail", async () => {
    const detail = {
      displayName: "New Card",
      sources: [],
      candidatePrintings: [],
      candidatePrintingGroups: [],
      defaultCardId: "",
      setTotals: {},
    };
    mockBuildUnmatchedDetail.mockResolvedValue(detail as any);

    const res = await app.request("/api/admin/v1/cards/new/newcard");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.displayName).toBe("New Card");
    expect(mockBuildUnmatchedDetail).toHaveBeenCalledWith(mockCandidateCards, "newcard", null);
  });

  it.each([
    { name: "decodes URI-encoded name parameter", path: "card%20name", decoded: "card name" },
    { name: "handles special characters in name", path: "ki%27ryn", decoded: "ki'ryn" },
  ])("$name", async ({ path, decoded }) => {
    mockBuildUnmatchedDetail.mockResolvedValue({ displayName: decoded } as any);

    await app.request(`/api/admin/v1/cards/new/${path}`);

    expect(mockBuildUnmatchedDetail).toHaveBeenCalledWith(mockCandidateCards, decoded, null);
  });
});
