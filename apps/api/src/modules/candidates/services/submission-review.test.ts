import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Repos, Transact } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import type { Io } from "../../../io.js";
import {
  acceptSubmission,
  createCardFromCandidate,
  rejectSubmission,
} from "./submission-review.js";

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
      findByCandidateCardId: vi.fn().mockResolvedValue(pendingSubmission),
      liveCardByNormName: vi.fn().mockResolvedValue({ id: "card-1", slug: "jinx" }),
      findByExternalId: vi.fn().mockResolvedValue(pendingSubmission),
      resolve: vi.fn(),
      setResolutionMessage: vi.fn(),
      candidatePrintingImageUrls: vi.fn().mockResolvedValue([]),
    },
    candidateCards: {
      candidateCardById: vi.fn().mockResolvedValue(candidate),
      checkCandidateCard: vi.fn(),
      checkCandidatePrintingsForCard: vi.fn(),
    },
    catalogMutations: {
      getFullCardById: vi.fn().mockResolvedValue({ id: "card-1", name: "Jinx", slug: "jinx" }),
      getCardBySlug: vi.fn().mockResolvedValue({ id: "card-9", name: "Ekko" }),
      updateCardById: vi.fn(),
      updatePrintingFieldById: vi.fn(),
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
    printingImages: { originalUrlsInUse: vi.fn().mockResolvedValue(new Set()) },
    ingest: {
      allUnlinkedCandidatePrintings: vi.fn().mockResolvedValue([]),
      allCardNorms: vi.fn().mockResolvedValue([]),
      allCardNameAliases: vi.fn().mockResolvedValue([]),
      allPrintingKeys: vi.fn().mockResolvedValue([]),
      allPrintingLinkOverrides: vi.fn().mockResolvedValue([]),
    },
    adminEvents: { insert: vi.fn() },
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

    expect(result).toEqual({ status: "accepted", applied: 1, createdPrintingIds: [] });
    expect(repos.catalogMutations.updateCardById).toHaveBeenCalledWith("card-1", { energy: 3 });
    expect(repos.candidateCards.checkCandidateCard).toHaveBeenCalledWith("cc-1");
    expect(repos.candidateCards.checkCandidatePrintingsForCard).toHaveBeenCalledWith("cc-1");
    expect(repos.cardSubmissions.resolve).toHaveBeenCalledWith("sub-1", {
      status: "accepted",
      resolvedAt: NOW,
      resolvedByUserId: ADMIN_ID,
      acceptedCardId: "card-1",
    });
    expect(repos.catalog.refreshCatalogViews).toHaveBeenCalledTimes(1);
  });

  it("resolves as not_applied when every pick was unticked", async () => {
    const repos = createRepos();

    const result = await acceptSubmission(transactOn(repos), repos, io, {
      ...baseArgs,
      ...noPicks,
    });

    expect(result).toEqual({ status: "not_applied", applied: 0, createdPrintingIds: [] });
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
    );
    expect(repos.keywords.listCostKeywords).not.toHaveBeenCalled();
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
        findByCandidateCardId: vi
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
      cardSubmissions: { findByCandidateCardId: vi.fn().mockResolvedValue(null) },
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

describe("rejectSubmission", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("writes the reason, ignores the candidate and resolves as rejected", async () => {
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
    expect(repos.cardSubmissions.findByExternalId).not.toHaveBeenCalled();
  });

  it("conflicts on a submission that is already settled", async () => {
    const repos = createRepos({
      cardSubmissions: {
        findByCandidateCardId: vi
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
        reason: "other",
        note: null,
      }),
    ).rejects.toBeInstanceOf(AppError);
    expect(repos.ignoredCandidates.ignoreCard).not.toHaveBeenCalled();
  });
});

describe("createCardFromCandidate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const cardFields = {
    id: "ekko",
    name: "Ekko",
    types: ["unit"],
    domains: ["body"],
  } as never;

  it("creates the card and resolves the ledger as accepted", async () => {
    const repos = createRepos({
      cardSubmissions: {
        findByCandidateCardId: vi
          .fn()
          .mockResolvedValue({ ...pendingSubmission, kind: "new_card" }),
        liveCardByNormName: vi.fn().mockResolvedValue(null),
        resolve: vi.fn(),
        candidatePrintingImageUrls: vi.fn().mockResolvedValue([]),
      },
    });

    const result = await createCardFromCandidate(transactOn(repos), repos, io, {
      ...baseArgs,
      cardFields,
      printings: [],
      images: [],
    });

    expect(result).toEqual({ cardSlug: "ekko", printingsCreated: 0 });
    expect(repos.catalogMutations.acceptNewCardFromSources).toHaveBeenCalledWith(
      cardFields,
      "jinx",
    );
    expect(repos.cardSubmissions.resolve).toHaveBeenCalledWith("sub-1", {
      status: "accepted",
      resolvedAt: NOW,
      resolvedByUserId: ADMIN_ID,
      acceptedCardId: "card-9",
    });
  });

  it("conflicts when a live card already holds the name", async () => {
    const repos = createRepos({
      cardSubmissions: {
        findByCandidateCardId: vi
          .fn()
          .mockResolvedValue({ ...pendingSubmission, kind: "new_card" }),
        liveCardByNormName: vi.fn().mockResolvedValue({ id: "card-1", slug: "jinx" }),
      },
    });

    await expect(
      createCardFromCandidate(transactOn(repos), repos, io, {
        ...baseArgs,
        cardFields,
        printings: [],
        images: [],
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(repos.catalogMutations.acceptNewCardFromSources).not.toHaveBeenCalled();
  });

  it("400s when the pending row is not a new-card proposal", async () => {
    const repos = createRepos();
    (repos.cardSubmissions.liveCardByNormName as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      createCardFromCandidate(transactOn(repos), repos, io, {
        ...baseArgs,
        cardFields,
        printings: [],
        images: [],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("creates a scrape's new-card group with no ledger row to settle", async () => {
    const repos = createRepos({
      cardSubmissions: {
        findByCandidateCardId: vi.fn().mockResolvedValue(null),
        liveCardByNormName: vi.fn().mockResolvedValue(null),
        resolve: vi.fn(),
      },
    });
    (repos.candidateCards.candidateCardById as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...candidate,
      provider: "playloltcg",
      externalId: "plc-42",
    });

    const result = await createCardFromCandidate(transactOn(repos), repos, io, {
      ...baseArgs,
      cardFields,
      printings: [],
      images: [],
    });

    expect(result).toEqual({ cardSlug: "ekko", printingsCreated: 0 });
    expect(repos.candidateCards.checkCandidateCard).toHaveBeenCalledWith("cc-1");
    expect(repos.cardSubmissions.resolve).not.toHaveBeenCalled();
  });

  it("forbids a candidate outside the granted providers", async () => {
    const repos = createRepos();

    await expect(
      createCardFromCandidate(transactOn(repos), repos, io, {
        ...baseArgs,
        scope: new Set(["gallery"]),
        cardFields,
        printings: [],
        images: [],
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(repos.catalogMutations.acceptNewCardFromSources).not.toHaveBeenCalled();
  });
});
