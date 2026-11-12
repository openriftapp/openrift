import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Repos, Transact } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import type { Io } from "../../../io.js";
import { acceptSubmission, moveSubmission, rejectSubmission } from "./submission-review.js";

const ADMIN_ID = "a0000000-0001-4000-a000-000000000001";
const NOW = new Date("2026-09-10T12:00:00Z");

const pendingSubmission = {
  id: "sub-1",
  status: "pending",
  kind: "correction",
  candidateCardId: "cc-1",
};

const candidate = {
  id: "cc-1",
  provider: "usersubmission",
  externalId: "jinx--20260901--u1",
  name: "Jinx",
  normName: "jinx",
};

function createRepos(overrides: Record<string, unknown> = {}) {
  const repos = {
    cardSubmissions: {
      getByCandidateCardId: vi.fn().mockResolvedValue(pendingSubmission),
      liveCardByNormName: vi.fn().mockResolvedValue({ id: "card-1", slug: "jinx" }),
      getByExternalId: vi.fn().mockResolvedValue(pendingSubmission),
      resolve: vi.fn(),
      setResolutionMessage: vi.fn(),
      setCard: vi.fn(),
      candidatePrintingImageUrls: vi.fn().mockResolvedValue([]),
    },
    candidateCards: {
      candidateCardById: vi.fn().mockResolvedValue(candidate),
      checkCandidateCard: vi.fn(),
      checkCandidatePrintingsForCard: vi.fn(),
      moveCandidateCardToCard: vi.fn(),
      removePrintingLinkOverridesForCandidateCard: vi.fn(),
    },
    catalogMutations: {
      getFullCardById: vi.fn().mockResolvedValue({ id: "card-1", name: "Jinx", slug: "jinx" }),
      getCardBySlug: vi.fn().mockResolvedValue({ id: "card-9", name: "Ekko" }),
      updateCardById: vi.fn(),
      updatePrintingFieldById: vi.fn(),
      sideOfFace: vi.fn().mockResolvedValue(2),
      acceptNewCardFromSources: vi.fn(),
      syncSelfAliasOnRename: vi.fn(),
    },
    keywords: {
      listCostKeywords: vi.fn().mockResolvedValue([]),
      recomputeForPrintingCard: vi.fn(),
    },
    cardTokens: { recomputeForPrintingCard: vi.fn() },
    catalog: { refreshCatalogViews: vi.fn(), refreshCardAggregates: vi.fn() },
    ignoredCandidates: { ignoreCard: vi.fn() },
    printingImages: {
      originalUrlsInUse: vi.fn().mockResolvedValue(new Set()),
      getCandidatePrintingById: vi
        .fn()
        .mockResolvedValue({ imageUrl: "https://example.test/gold.png", shortCode: "OGN-T05" }),
      faceForShortCode: vi.fn().mockResolvedValue("back"),
      insertImage: vi.fn().mockResolvedValue("image-1"),
      getForRehost: vi.fn().mockResolvedValue(undefined),
    },
    ingest: {
      allUnlinkedCandidatePrintings: vi.fn().mockResolvedValue([]),
      allCardNorms: vi.fn().mockResolvedValue([]),
      allCardNameAliases: vi.fn().mockResolvedValue([]),
      allPrintingKeys: vi.fn().mockResolvedValue([]),
      allPrintingLinkOverrides: vi.fn().mockResolvedValue([]),
    },
    adminEvents: { insert: vi.fn() },
    enums: {
      all: vi.fn().mockResolvedValue({
        languages: [{ slug: "EN" }],
        rarities: [{ slug: "common" }],
        artVariants: [{ slug: "normal" }],
        finishes: [{ slug: "normal" }],
        cardSizes: [{ slug: "standard" }],
        markers: [],
      }),
    },
    distributionChannels: { listBySlugs: vi.fn().mockResolvedValue([]) },
    ...overrides,
  };
  return repos as unknown as Repos;
}

const io = {} as Io;

function transactOn(repos: Repos): Transact {
  return (fn) => fn(repos);
}

const baseArgs = {
  candidateCardId: "cc-1",
  adminUserId: ADMIN_ID,
  scope: null,
  now: NOW,
};

const noPicks = { cardFields: [], printingFields: [], newPrintings: [], images: [] };

describe("acceptSubmission", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("applies a card-field pick and resolves the ledger as accepted", async () => {
    const repos = createRepos();

    const result = await acceptSubmission(transactOn(repos), repos, io, {
      ...baseArgs,
      ...noPicks,
      cardFields: [{ field: "energy", value: 3 }],
    });

    expect(result).toEqual({
      status: "accepted",
      applied: 1,
      createdPrintingIds: [],
      skipped: [],
    });
    expect(repos.catalogMutations.updateCardById).toHaveBeenCalledWith("card-1", { energy: 3 });
    expect(repos.candidateCards.checkCandidateCard).toHaveBeenCalledWith("cc-1");
    expect(repos.candidateCards.checkCandidatePrintingsForCard).toHaveBeenCalledWith("cc-1", []);
    expect(repos.cardSubmissions.resolve).toHaveBeenCalledWith("sub-1", {
      status: "accepted",
      resolvedAt: NOW,
      resolvedByUserId: ADMIN_ID,
      acceptedCardId: "card-1",
    });
    expect(repos.catalog.refreshCatalogViews).toHaveBeenCalledTimes(1);
  });

  it("skips a new printing carrying a value no admin list holds, and applies the rest", async () => {
    const repos = createRepos();

    const result = await acceptSubmission(transactOn(repos), repos, io, {
      ...baseArgs,
      ...noPicks,
      cardFields: [{ field: "energy", value: 3 }],
      newPrintings: [
        {
          candidatePrintingId: "cp-1",
          printingFields: {
            shortCode: "UNL-131",
            artist: "A",
            rarity: "common",
            publicCode: "UNL-131",
            language: "JP",
            markerSlugs: [],
            distributionChannelSlugs: [],
          },
        },
      ],
    });

    expect(result.status).toBe("accepted");
    expect(result.applied).toBe(1);
    expect(result.createdPrintingIds).toEqual([]);
    expect(result.skipped).toEqual([
      { candidatePrintingId: "cp-1", reason: 'not on an admin list: language "JP"' },
    ]);
  });

  it("leaves a skipped printing unchecked so it stays in the queue", async () => {
    const repos = createRepos();

    await acceptSubmission(transactOn(repos), repos, io, {
      ...baseArgs,
      ...noPicks,
      cardFields: [{ field: "energy", value: 3 }],
      newPrintings: [
        {
          candidatePrintingId: "cp-1",
          printingFields: {
            shortCode: "UNL-131",
            artist: "A",
            rarity: "common",
            publicCode: "UNL-131",
            language: "JP",
            markerSlugs: [],
            distributionChannelSlugs: [],
          },
        },
      ],
    });

    expect(repos.candidateCards.checkCandidatePrintingsForCard).toHaveBeenCalledWith("cc-1", [
      "cp-1",
    ]);
  });

  it("refuses when a skip is the only thing there was to do", async () => {
    const repos = createRepos();

    await expect(
      acceptSubmission(transactOn(repos), repos, io, {
        ...baseArgs,
        ...noPicks,
        newPrintings: [
          {
            candidatePrintingId: "cp-1",
            printingFields: {
              shortCode: "UNL-131",
              artist: "A",
              rarity: "common",
              publicCode: "UNL-131",
              language: "JP",
              markerSlugs: [],
              distributionChannelSlugs: [],
            },
          },
        ],
      }),
    ).rejects.toThrow(AppError);
    expect(repos.cardSubmissions.resolve).not.toHaveBeenCalled();
  });

  it("skips a new printing that already exists on the card instead of overwriting it", async () => {
    const repos = createRepos();
    Object.assign(repos.catalogMutations, {
      getPrintingCardIdByComposite: vi.fn().mockResolvedValue({ cardId: "card-1" }),
      findPrintingIdByIdentity: vi.fn().mockResolvedValue({ id: "p-live" }),
      getCardById: vi.fn(),
    });
    const existing = {
      candidatePrintingId: "cp-1",
      printingFields: {
        shortCode: "OGN-027",
        artist: "Overwriting Artist",
        rarity: "common",
        publicCode: "OGN-027",
        markerSlugs: [],
        distributionChannelSlugs: [],
      },
    };

    const result = await acceptSubmission(transactOn(repos), repos, io, {
      ...baseArgs,
      ...noPicks,
      cardFields: [{ field: "energy", value: 3 }],
      newPrintings: [existing],
    });

    expect(result.createdPrintingIds).toEqual([]);
    expect(result.skipped).toEqual([
      {
        candidatePrintingId: "cp-1",
        reason: expect.stringContaining(
          'This card already has a printing with short code "OGN-027"',
        ),
      },
    ]);
    expect(repos.catalogMutations.getCardById).not.toHaveBeenCalled();
    expect(repos.candidateCards.checkCandidatePrintingsForCard).toHaveBeenCalledWith("cc-1", [
      "cp-1",
    ]);
  });

  it("links a colliding pick to the existing printing in the same request", async () => {
    const linkCandidatePrintings = vi.fn();
    const repos = createRepos({
      ingest: {
        allUnlinkedCandidatePrintings: vi.fn().mockResolvedValue([
          {
            id: "cp-1",
            shortCode: "OGN-027",
            finish: null,
            rarity: "common",
            markerSlugs: [],
            language: "EN",
            externalId: "jinx--1",
            size: null,
            cardName: "Jinx",
            provider: "usersubmission",
          },
        ]),
        allCardNorms: vi.fn().mockResolvedValue([{ id: "card-1", normName: "jinx" }]),
        allCardNameAliases: vi.fn().mockResolvedValue([]),
        allPrintingKeys: vi.fn().mockResolvedValue([
          {
            id: "p-live",
            cardId: "card-1",
            shortCode: "OGN-027",
            finish: "normal",
            markerSlugs: [],
            language: "EN",
            size: "standard",
          },
        ]),
        allPrintingLinkOverrides: vi.fn().mockResolvedValue([]),
      },
    });
    Object.assign(repos.candidateCards, { linkCandidatePrintings });
    Object.assign(repos.catalogMutations, {
      getPrintingCardIdByComposite: vi.fn().mockResolvedValue({ cardId: "card-1" }),
      findPrintingIdByIdentity: vi.fn().mockResolvedValue({ id: "p-live" }),
    });
    const collidingPick = {
      candidatePrintingId: "cp-1",
      printingFields: {
        shortCode: "OGN-027",
        rarity: "common",
        artist: "A",
        publicCode: "OGN-027",
        markerSlugs: [],
        distributionChannelSlugs: [],
      },
    };

    const result = await acceptSubmission(transactOn(repos), repos, io, {
      ...baseArgs,
      ...noPicks,
      cardFields: [{ field: "energy", value: 3 }],
      newPrintings: [collidingPick],
    });

    expect(result.createdPrintingIds).toEqual([]);
    expect(linkCandidatePrintings).toHaveBeenCalledWith(["cp-1"], "p-live");
  });

  it("links a colliding pick even when nothing else could be applied", async () => {
    const repos = createRepos();
    Object.assign(repos.catalogMutations, {
      getPrintingCardIdByComposite: vi.fn().mockResolvedValue({ cardId: "card-1" }),
      findPrintingIdByIdentity: vi.fn().mockResolvedValue({ id: "p-live" }),
    });

    await expect(
      acceptSubmission(transactOn(repos), repos, io, {
        ...baseArgs,
        ...noPicks,
        newPrintings: [
          {
            candidatePrintingId: "cp-1",
            printingFields: {
              shortCode: "OGN-027",
              rarity: "common",
              artist: "A",
              publicCode: "OGN-027",
              markerSlugs: [],
              distributionChannelSlugs: [],
            },
          },
        ],
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(repos.ingest.allUnlinkedCandidatePrintings).toHaveBeenCalled();
  });

  it("409s when a concurrent printing wins the identity at commit", async () => {
    const repos = createRepos();
    const failingCommit: Transact = async (fn) => {
      await fn(repos);
      throw Object.assign(new Error("duplicate key"), {
        code: "23505",
        constraint_name: "uq_faces_identity",
      });
    };

    await expect(
      acceptSubmission(failingCommit, repos, io, {
        ...baseArgs,
        ...noPicks,
        cardFields: [{ field: "energy", value: 3 }],
      }),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("skips a second pick of the same printing identity", async () => {
    const repos = createRepos();
    Object.assign(repos.catalogMutations, {
      getPrintingCardIdByComposite: vi.fn().mockResolvedValue(null),
      findPrintingIdByIdentity: vi.fn().mockResolvedValue({ id: "p-live" }),
    });
    const fields = {
      shortCode: "OGN-027",
      artist: "A",
      rarity: "common",
      publicCode: "OGN-027",
      markerSlugs: [],
      distributionChannelSlugs: [],
    };

    await expect(
      acceptSubmission(transactOn(repos), repos, io, {
        ...baseArgs,
        ...noPicks,
        newPrintings: [
          { candidatePrintingId: "cp-1", printingFields: { ...fields, finish: "normal" } },
          { candidatePrintingId: "cp-2", printingFields: { ...fields, shortCode: "ogn-027" } },
        ],
      }),
    ).rejects.toThrow("another picked printing has the same short code");
    expect(repos.catalogMutations.findPrintingIdByIdentity).toHaveBeenCalledTimes(1);
    expect(repos.cardSubmissions.resolve).not.toHaveBeenCalled();
  });

  it("skips a new size whose existing side has different printed values and applies the rest", async () => {
    const repos = createRepos({
      sets: { getPrintedTotal: vi.fn().mockResolvedValue(null) },
    } as never);
    Object.assign(repos.catalogMutations, {
      getPrintingCardIdByComposite: vi.fn().mockResolvedValue(null),
      findPrintingIdByIdentity: vi.fn().mockResolvedValue(null),
      findFaceIdByIdentity: vi.fn().mockResolvedValue({ id: "face-1" }),
      getSetIdBySlug: vi.fn().mockResolvedValue({ id: "set-uuid" }),
      getFacePrintedFields: vi.fn().mockResolvedValue({
        setId: "set-uuid",
        rarity: "common",
        artVariant: "normal",
        isSigned: false,
        isOvernumbered: false,
        artist: "Old Artist",
        publicCode: "OGN-027",
        printedRulesText: null,
        printedEffectText: null,
        flavorText: null,
        printedName: null,
        printedYear: null,
      }),
    });

    const result = await acceptSubmission(transactOn(repos), repos, io, {
      ...baseArgs,
      ...noPicks,
      cardFields: [{ field: "energy", value: 3 }],
      newPrintings: [
        {
          candidatePrintingId: "cp-1",
          printingFields: {
            shortCode: "OGN-027",
            setId: "ogn",
            artist: "New Artist",
            rarity: "common",
            publicCode: "OGN-027",
            size: "standard",
            markerSlugs: [],
            distributionChannelSlugs: [],
          },
        },
      ],
    });

    expect(result.skipped).toEqual([
      {
        candidatePrintingId: "cp-1",
        reason:
          "The existing OGN-027 normal EN side differs in artist. Edit that side or the source first.",
      },
    ]);
    expect(result.applied).toBe(1);
  });

  it("resolves as not_applied when every pick was unticked", async () => {
    const repos = createRepos();

    const result = await acceptSubmission(transactOn(repos), repos, io, {
      ...baseArgs,
      ...noPicks,
    });

    expect(result).toEqual({
      status: "not_applied",
      applied: 0,
      createdPrintingIds: [],
      skipped: [],
    });
    expect(repos.cardSubmissions.resolve).toHaveBeenCalledWith("sub-1", {
      status: "not_applied",
      resolvedAt: NOW,
      resolvedByUserId: ADMIN_ID,
      acceptedCardId: null,
    });
    expect(repos.cardSubmissions.candidatePrintingImageUrls).toHaveBeenCalledWith("cc-1");
  });

  it("applies typography to an untouched printing pick", async () => {
    const repos = createRepos();

    await acceptSubmission(transactOn(repos), repos, io, {
      ...baseArgs,
      ...noPicks,
      printingFields: [
        {
          printingId: "p-1",
          field: "printedRulesText",
          value: "It's ready...",
          source: "provider",
        },
      ],
    });

    expect(repos.catalogMutations.updatePrintingFieldById).toHaveBeenCalledWith(
      "p-1",
      "printedRulesText",
      "It’s ready…",
      1,
    );
  });

  it("leaves an edited printing pick exactly as the reviewer typed it", async () => {
    const repos = createRepos();

    await acceptSubmission(transactOn(repos), repos, io, {
      ...baseArgs,
      ...noPicks,
      printingFields: [
        {
          printingId: "p-1",
          field: "printedRulesText",
          value: "It's ready...",
          source: "manual",
        },
      ],
    });

    expect(repos.catalogMutations.updatePrintingFieldById).toHaveBeenCalledWith(
      "p-1",
      "printedRulesText",
      "It's ready...",
      1,
    );
    expect(repos.keywords.listCostKeywords).not.toHaveBeenCalled();
  });

  it("writes a printing pick to the side its face is on", async () => {
    const repos = createRepos();

    await acceptSubmission(transactOn(repos), repos, io, {
      ...baseArgs,
      ...noPicks,
      printingFields: [
        {
          printingId: "p-1",
          faceId: "face-gold",
          field: "artist",
          value: "Gold Artist",
          source: "manual",
        },
      ],
    });

    expect(repos.catalogMutations.sideOfFace).toHaveBeenCalledWith("p-1", "face-gold");
    expect(repos.catalogMutations.updatePrintingFieldById).toHaveBeenCalledWith(
      "p-1",
      "artist",
      "Gold Artist",
      2,
    );
  });

  it("normalizes a printing pick against the side its face is on", async () => {
    const repos = createRepos();
    vi.mocked(repos.catalogMutations).getSetPrintedTotalForPrinting = vi
      .fn()
      .mockResolvedValue({ printedTotal: 10 }) as never;

    await acceptSubmission(transactOn(repos), repos, io, {
      ...baseArgs,
      ...noPicks,
      printingFields: [
        {
          printingId: "p-1",
          faceId: "face-gold",
          field: "publicCode",
          value: "OGN-T05",
          source: "provider",
        },
      ],
    });

    expect(repos.catalogMutations.getSetPrintedTotalForPrinting).toHaveBeenCalledWith("p-1", 2);
  });

  it("attaches a candidate image to the side the reviewer picked", async () => {
    const repos = createRepos();

    await acceptSubmission(transactOn(repos), repos, io, {
      ...baseArgs,
      ...noPicks,
      images: [{ candidatePrintingId: "cp-1", printingId: "p-1", faceId: "face-gold" }],
    });

    expect(repos.printingImages.insertImage).toHaveBeenCalledWith(
      "p-1",
      "https://example.test/gold.png",
      "main",
      "back",
    );
    expect(repos.printingImages.faceForShortCode).not.toHaveBeenCalled();
  });

  it("attaches a candidate image by its short code when no side was picked", async () => {
    const repos = createRepos();

    await acceptSubmission(transactOn(repos), repos, io, {
      ...baseArgs,
      ...noPicks,
      images: [{ candidatePrintingId: "cp-1", printingId: "p-1" }],
    });

    expect(repos.printingImages.faceForShortCode).toHaveBeenCalledWith("p-1", "OGN-T05");
    expect(repos.printingImages.insertImage).toHaveBeenCalledWith(
      "p-1",
      "https://example.test/gold.png",
      "main",
      "back",
    );
  });

  it("reads the card once for a run of card picks", async () => {
    const repos = createRepos();

    await acceptSubmission(transactOn(repos), repos, io, {
      ...baseArgs,
      ...noPicks,
      cardFields: [
        { field: "energy", value: 3 },
        { field: "power", value: 2 },
      ],
    });

    expect(repos.catalogMutations.getFullCardById).toHaveBeenCalledTimes(1);
    expect(repos.catalogMutations.updateCardById).toHaveBeenCalledTimes(2);
  });

  it("skips the view refresh when nothing was applied", async () => {
    const repos = createRepos();

    await acceptSubmission(transactOn(repos), repos, io, { ...baseArgs, ...noPicks });

    expect(repos.catalog.refreshCatalogViews).not.toHaveBeenCalled();
  });

  it("rejects an invalid pick value with 400", async () => {
    const repos = createRepos();

    await expect(
      acceptSubmission(transactOn(repos), repos, io, {
        ...baseArgs,
        ...noPicks,
        cardFields: [{ field: "energy", value: "lots" }],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("conflicts on a submission that is already settled", async () => {
    const repos = createRepos({
      cardSubmissions: {
        getByCandidateCardId: vi
          .fn()
          .mockResolvedValue({ ...pendingSubmission, status: "accepted" }),
      },
    });

    await expect(
      acceptSubmission(transactOn(repos), repos, io, { ...baseArgs, ...noPicks }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("404s when no ledger row points at the candidate", async () => {
    const repos = createRepos({
      cardSubmissions: { getByCandidateCardId: vi.fn().mockResolvedValue(null) },
    });

    await expect(
      acceptSubmission(transactOn(repos), repos, io, { ...baseArgs, ...noPicks }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("404s when the correction has no live card to apply to", async () => {
    const repos = createRepos();
    (repos.cardSubmissions.liveCardByNormName as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      acceptSubmission(transactOn(repos), repos, io, {
        ...baseArgs,
        ...noPicks,
        cardFields: [{ field: "energy", value: 3 }],
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("forbids a grant holder whose scope excludes the candidate's provider", async () => {
    const repos = createRepos();

    await expect(
      acceptSubmission(transactOn(repos), repos, io, {
        ...baseArgs,
        ...noPicks,
        scope: new Set(["gallery"]),
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(repos.cardSubmissions.resolve).not.toHaveBeenCalled();
  });
});

describe("moveSubmission", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const ekko = { id: "card-9", name: "Ekko", normName: "ekko", slug: "ekko" };

  it("points the candidate and the ledger row at the picked card", async () => {
    const repos = createRepos();
    vi.mocked(repos.catalogMutations.getFullCardById).mockResolvedValue(ekko as never);

    const result = await moveSubmission(transactOn(repos), repos, {
      ...baseArgs,
      cardId: "card-9",
    });

    expect(result).toEqual({ cardSlug: "ekko" });
    expect(repos.candidateCards.moveCandidateCardToCard).toHaveBeenCalledWith("cc-1", {
      name: "Ekko",
      normName: "ekko",
    });
    expect(repos.cardSubmissions.setCard).toHaveBeenCalledWith("sub-1", {
      name: "Ekko",
      slug: "ekko",
    });
    expect(repos.candidateCards.removePrintingLinkOverridesForCandidateCard).toHaveBeenCalledWith(
      "cc-1",
    );
    expect(repos.adminEvents.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "card-submission.move", cardSlug: "ekko" }),
    );
  });

  it("refuses to move a submission onto the card it already belongs to", async () => {
    const repos = createRepos();
    vi.mocked(repos.catalogMutations.getFullCardById).mockResolvedValue({
      ...ekko,
      name: "Jinx",
      normName: "jinx",
    } as never);

    await expect(
      moveSubmission(transactOn(repos), repos, { ...baseArgs, cardId: "card-1" }),
    ).rejects.toMatchObject({ status: 400 });
    expect(repos.candidateCards.moveCandidateCardToCard).not.toHaveBeenCalled();
  });

  it("refuses a settled submission", async () => {
    const repos = createRepos();
    vi.mocked(repos.cardSubmissions.getByCandidateCardId).mockResolvedValue({
      ...pendingSubmission,
      status: "accepted",
    } as never);

    await expect(
      moveSubmission(transactOn(repos), repos, { ...baseArgs, cardId: "card-9" }),
    ).rejects.toBeInstanceOf(AppError);
    expect(repos.candidateCards.moveCandidateCardToCard).not.toHaveBeenCalled();
  });

  it("refuses a card that does not exist", async () => {
    const repos = createRepos();
    vi.mocked(repos.catalogMutations.getFullCardById).mockResolvedValue(undefined);

    await expect(
      moveSubmission(transactOn(repos), repos, { ...baseArgs, cardId: "missing" }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("rejectSubmission", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("writes the message, ignores the candidate and resolves as rejected", async () => {
    const repos = createRepos();

    await rejectSubmission(transactOn(repos), repos, io, {
      ...baseArgs,
      reason: "unverified",
      note: "No source for this printing",
    });

    expect(repos.cardSubmissions.setResolutionMessage).toHaveBeenCalledWith("sub-1", {
      reason: "unverified",
      note: "No source for this printing",
      resolvedByUserId: ADMIN_ID,
    });
    expect(repos.ignoredCandidates.ignoreCard).toHaveBeenCalledWith({
      provider: "usersubmission",
      externalId: "jinx--20260901--u1",
    });
    expect(repos.cardSubmissions.resolve).toHaveBeenCalledWith("sub-1", {
      status: "rejected",
      resolvedAt: NOW,
      resolvedByUserId: ADMIN_ID,
    });
    expect(repos.cardSubmissions.getByExternalId).not.toHaveBeenCalled();
  });

  it("conflicts on a submission that is already settled", async () => {
    const repos = createRepos({
      cardSubmissions: {
        getByCandidateCardId: vi
          .fn()
          .mockResolvedValue({ ...pendingSubmission, status: "rejected" }),
      },
    });

    await expect(
      rejectSubmission(transactOn(repos), repos, io, {
        ...baseArgs,
        reason: "duplicate",
        note: null,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("forbids an out-of-scope provider", async () => {
    const repos = createRepos();

    await expect(
      rejectSubmission(transactOn(repos), repos, io, {
        ...baseArgs,
        scope: new Set(["gallery"]),
        reason: "duplicate",
        note: null,
      }),
    ).rejects.toBeInstanceOf(AppError);
    expect(repos.ignoredCandidates.ignoreCard).not.toHaveBeenCalled();
  });
});
