import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { adminCatalogReviewRouter } from "./admin-catalog-review.js";

const USER_ID = "a0000000-0001-4000-a000-000000000001";
const BASE = "/api/admin/v1/catalog";

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

const repos = {
  providerSettings: { helperReviewableProviders: vi.fn() },
  cardSubmissions: {
    pendingReviewQueueRows: vi.fn(),
    findByCandidateCardId: vi.fn(),
    liveCardByNormName: vi.fn(),
    findByExternalId: vi.fn(),
    resolve: vi.fn(),
    setResolutionMessage: vi.fn(),
    candidatePrintingImageUrls: vi.fn(),
  },
  candidateCards: {
    listSourceReviewGroups: vi.fn(),
    cardSlugsByNormNames: vi.fn(),
    candidateCardById: vi.fn(),
    checkCandidateCard: vi.fn(),
    checkCandidatePrintingsForCard: vi.fn(),
  },
  catalogMutations: {
    getFullCardById: vi.fn(),
    getCardBySlug: vi.fn(),
    updateCardById: vi.fn(),
    acceptNewCardFromSources: vi.fn(),
  },
  catalog: { refreshCatalogViews: vi.fn() },
  ignoredCandidates: { ignoreCard: vi.fn() },
  printingImages: { originalUrlsInUse: vi.fn() },
  ingest: {
    allUnlinkedCandidatePrintings: vi.fn(),
    allCardNorms: vi.fn(),
    allCardNameAliases: vi.fn(),
    allPrintingKeys: vi.fn(),
    allPrintingLinkOverrides: vi.fn(),
  },
  adminEvents: { insert: vi.fn() },
};

let adminAccess: { isAdmin: boolean; sections: string[] } = { isAdmin: true, sections: [] };

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: USER_ID } as never);
  c.set("adminAccess", adminAccess as never);
  c.set("repos", repos as never);
  c.set("io", {} as never);
  c.set("transact", ((fn: (r: unknown) => unknown) => fn(repos)) as never);
  await next();
});
registerRouterForTest(app, adminCatalogReviewRouter);

async function post(path: string, body: unknown): Promise<Response> {
  return await app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function resetDefaults(): void {
  vi.resetAllMocks();
  adminAccess = { isAdmin: true, sections: [] };
  repos.providerSettings.helperReviewableProviders.mockResolvedValue(new Set(["usersubmission"]));
  repos.cardSubmissions.pendingReviewQueueRows.mockResolvedValue([]);
  repos.cardSubmissions.findByCandidateCardId.mockResolvedValue(pendingSubmission);
  repos.cardSubmissions.liveCardByNormName.mockResolvedValue({ id: "card-1", slug: "jinx" });
  repos.cardSubmissions.findByExternalId.mockResolvedValue(pendingSubmission);
  repos.cardSubmissions.candidatePrintingImageUrls.mockResolvedValue([]);
  repos.candidateCards.listSourceReviewGroups.mockResolvedValue([]);
  repos.candidateCards.cardSlugsByNormNames.mockResolvedValue([]);
  repos.candidateCards.candidateCardById.mockResolvedValue(candidate);
  repos.catalogMutations.getFullCardById.mockResolvedValue({ id: "card-1", name: "Jinx" });
  repos.catalogMutations.getCardBySlug.mockResolvedValue({ id: "card-9", name: "Ekko" });
  repos.printingImages.originalUrlsInUse.mockResolvedValue(new Set());
  repos.ingest.allUnlinkedCandidatePrintings.mockResolvedValue([]);
  repos.ingest.allCardNorms.mockResolvedValue([]);
  repos.ingest.allCardNameAliases.mockResolvedValue([]);
  repos.ingest.allPrintingKeys.mockResolvedValue([]);
  repos.ingest.allPrintingLinkOverrides.mockResolvedValue([]);
}

describe(`GET ${BASE}/review`, () => {
  beforeEach(resetDefaults);

  it("returns the queue with counts", async () => {
    repos.cardSubmissions.pendingReviewQueueRows.mockResolvedValue([
      {
        id: "sub-1",
        kind: "image",
        provider: "usersubmission",
        cardName: "Jinx",
        normName: "jinx",
        candidateCardId: "cc-1",
        submitterName: "Ekko Fan",
        note: null,
        proposedDiff: ["printing.OGN-002|foil||EN.image"],
        uncheckedPrintings: 1,
        newPrintings: 0,
        createdAt: new Date("2026-09-01T10:00:00Z"),
      },
    ]);
    repos.candidateCards.cardSlugsByNormNames.mockResolvedValue([
      { normName: "jinx", slug: "jinx" },
    ]);

    const res = await app.request(`${BASE}/review`);

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.counts).toEqual({ open: 1, contributors: 1, sources: 0 });
    expect(json.items[0]).toMatchObject({ id: "sub-1", kind: "image", cardSlug: "jinx" });
  });
});

describe(`POST ${BASE}/submissions/{id}/accept`, () => {
  beforeEach(resetDefaults);

  it("applies the ticked card field and reports the outcome", async () => {
    const res = await post(`${BASE}/submissions/cc-1/accept`, {
      cardFields: [{ field: "energy", value: 3 }],
    });

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({
      status: "accepted",
      applied: 1,
      createdPrintingIds: [],
    });
  });

  it("returns 409 when the submission is already settled", async () => {
    repos.cardSubmissions.findByCandidateCardId.mockResolvedValue({
      ...pendingSubmission,
      status: "rejected",
    });

    const res = await post(`${BASE}/submissions/cc-1/accept`, {});
    expect(res.status).toBe(409);
  });

  it("returns 404 when no submission points at the candidate", async () => {
    repos.cardSubmissions.findByCandidateCardId.mockResolvedValue(null);

    const res = await post(`${BASE}/submissions/cc-1/accept`, {});
    expect(res.status).toBe(404);
  });

  it("lets a grant holder accept a candidate from a helper-reviewable provider", async () => {
    adminAccess = { isAdmin: false, sections: ["card-review"] };

    const res = await post(`${BASE}/submissions/cc-1/accept`, {
      cardFields: [{ field: "energy", value: 3 }],
    });

    expect(res.status).toBe(200);
    expect(repos.providerSettings.helperReviewableProviders).toHaveBeenCalled();
  });

  it("returns 403 for a grant holder whose providers exclude the candidate", async () => {
    adminAccess = { isAdmin: false, sections: ["card-review"] };
    repos.providerSettings.helperReviewableProviders.mockResolvedValue(new Set(["gallery"]));

    const res = await post(`${BASE}/submissions/cc-1/accept`, {});

    expect(res.status).toBe(403);
    expect(repos.cardSubmissions.resolve).not.toHaveBeenCalled();
  });
});

describe(`POST ${BASE}/submissions/{id}/reject`, () => {
  beforeEach(resetDefaults);

  it("returns 204 and ignores the candidate", async () => {
    const res = await post(`${BASE}/submissions/cc-1/reject`, {
      reason: "not_a_card",
      note: null,
    });

    expect(res.status).toBe(204);
    expect(repos.ignoredCandidates.ignoreCard).toHaveBeenCalledWith({
      provider: "usersubmission",
      externalId: "jinx--20260901--u1",
    });
  });

  it("returns 409 for an already settled submission", async () => {
    repos.cardSubmissions.findByCandidateCardId.mockResolvedValue({
      ...pendingSubmission,
      status: "accepted",
    });

    const res = await post(`${BASE}/submissions/cc-1/reject`, {
      reason: "duplicate",
      note: null,
    });
    expect(res.status).toBe(409);
  });
});

describe(`POST ${BASE}/candidates/{id}/create-card`, () => {
  beforeEach(resetDefaults);

  const cardFields = { id: "ekko", name: "Ekko", types: ["unit"], domains: ["body"] };

  it("creates the card and returns its slug", async () => {
    repos.cardSubmissions.findByCandidateCardId.mockResolvedValue({
      ...pendingSubmission,
      kind: "new_card",
    });
    repos.cardSubmissions.liveCardByNormName.mockResolvedValue(null);

    const res = await post(`${BASE}/candidates/cc-1/create-card`, { cardFields });

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ cardSlug: "ekko", printingsCreated: 0 });
  });

  it("creates a card for a candidate with no ledger row", async () => {
    repos.cardSubmissions.findByCandidateCardId.mockResolvedValue(null);
    repos.cardSubmissions.liveCardByNormName.mockResolvedValue(null);
    repos.candidateCards.candidateCardById.mockResolvedValue({
      ...candidate,
      provider: "playloltcg",
      externalId: "plc-42",
    });

    const res = await post(`${BASE}/candidates/cc-1/create-card`, { cardFields });

    expect(res.status).toBe(200);
    expect(repos.cardSubmissions.resolve).not.toHaveBeenCalled();
  });

  it("returns 400 when the pending row is not a new-card proposal", async () => {
    repos.cardSubmissions.liveCardByNormName.mockResolvedValue(null);

    const res = await post(`${BASE}/candidates/cc-1/create-card`, { cardFields });

    expect(res.status).toBe(400);
  });

  it("returns 409 when the card already exists", async () => {
    repos.cardSubmissions.findByCandidateCardId.mockResolvedValue({
      ...pendingSubmission,
      kind: "new_card",
    });

    const res = await post(`${BASE}/candidates/cc-1/create-card`, { cardFields });

    expect(res.status).toBe(409);
  });
});
