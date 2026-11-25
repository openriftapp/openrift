import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import { appendSetTotal, fixTypography } from "@openrift/shared/fix-typography";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { badRequest } from "../../../errors.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { finishPrintingAccepts } from "../../candidates/services/accept-candidate-printings.js";
import { acceptFavoritePrintingsForCard } from "../../candidates/services/accept-favorite-printings.js";
import { acceptFavoriteNewCard } from "../../candidates/services/accept-gallery.js";
import { resolveCheckedSubmissions } from "../../candidates/services/card-submission-outcomes.js";
import { importErrata } from "../../candidates/services/import-errata.js";
import { ingestCandidates } from "../../candidates/services/ingest-candidates.js";
import {
  relinkCandidatePrintings,
  reresolveEditedCandidateLink,
} from "../../candidates/services/relink-candidates.js";
import { assertFavoriteNewCardEligible } from "../../candidates/services/trusted-accept-checks.js";
import {
  deletePrinting,
  createNewPrinting,
  createNewPrintings,
  updatePrintingDistributionChannels,
  updatePrintingMarkers,
} from "../services/printing-admin.js";
import { adminCardMutationsRouter } from "./admin-cards-mutations";

vi.mock("../services/printing-admin.js", async (importOriginal) => ({
  ...(await importOriginal()),
  createNewPrinting: vi.fn(),
  createNewPrintings: vi.fn(),
  deletePrinting: vi.fn(),
  updatePrintingMarkers: vi.fn(),
  updatePrintingDistributionChannels: vi.fn(),
}));

vi.mock("../../candidates/services/accept-candidate-printings.js", () => ({
  finishPrintingAccepts: vi.fn(),
}));
vi.mock("../../candidates/services/accept-gallery.js", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  acceptFavoriteNewCard: vi.fn(),
}));
vi.mock("../../candidates/services/trusted-accept-checks.js", () => ({
  assertFavoriteNewCardEligible: vi.fn(),
}));
vi.mock("../../candidates/services/import-errata.js", () => ({ importErrata: vi.fn() }));
vi.mock("../../candidates/services/ingest-candidates.js", () => ({ ingestCandidates: vi.fn() }));
vi.mock("../../candidates/services/accept-favorite-printings.js", () => ({
  acceptFavoritePrintingsForCard: vi.fn(),
}));
vi.mock("../../candidates/services/relink-candidates.js", () => ({
  relinkCandidatePrintings: vi.fn(),
  reresolveEditedCandidateLink: vi.fn(),
}));
vi.mock("../../candidates/services/card-submission-outcomes.js", () => ({
  resolveCheckedSubmissions: vi.fn(async () => []),
}));

vi.mock("@openrift/shared/fix-typography", async (importOriginal) => ({
  ...(await importOriginal()),
  fixTypography: vi.fn((text: string) => text),
  appendSetTotal: vi.fn((code: string) => code),
}));

const mockDeletePrinting = vi.mocked(deletePrinting);
const mockUpdatePrintingMarkers = vi.mocked(updatePrintingMarkers);
const mockCreateNewPrinting = vi.mocked(createNewPrinting);
const mockCreateNewPrintings = vi.mocked(createNewPrintings);
const mockFinishPrintingAccepts = vi.mocked(finishPrintingAccepts);
const mockAcceptFavoriteNewCard = vi.mocked(acceptFavoriteNewCard);
const mockAcceptFavoritePrintingsForCard = vi.mocked(acceptFavoritePrintingsForCard);
const mockRelinkCandidatePrintings = vi.mocked(relinkCandidatePrintings);
const mockFixTypography = vi.mocked(fixTypography);
const mockAppendSetTotal = vi.mocked(appendSetTotal);

const mockMut = {
  getCardById: vi.fn(),
  getPrintingDifferentiatorsById: vi.fn(),
  renameCardSlugById: vi.fn(),
  getPrintingTextsForCardId: vi.fn(),
  updateCardById: vi.fn(),
  replaceCardDomainsById: vi.fn(),
  getCardDomainsById: vi.fn(),
  getCardSuperTypesById: vi.fn(),
  getCardTypesById: vi.fn(),
  replaceCardSuperTypesById: vi.fn(),
  getFullPrintingById: vi.fn(),
  sideOfFace: vi.fn(),
  getFullCardById: vi.fn(),
  updatePrintingFieldById: vi.fn(),
  getSetPrintedTotalForPrinting: vi.fn(),
  lockCardRow: vi.fn(),
  syncSelfAliasOnRename: vi.fn(),
  lockPrintingSide: vi.fn(),
};

const mockCardErrata = {
  upsert: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(async () => null),
  getByCardIds: vi.fn(async () => []),
};

const mockKeywords = { recomputeForPrintingCard: vi.fn() };

const mockCatalogDeleteGuards = { countForCard: vi.fn(), countForPrinting: vi.fn() };

const mockAdminEvents = { insert: vi.fn(), insertMany: vi.fn() };

const mockDistributionChannels = {
  listBySlugs: vi.fn(async () => []),
  setForPrinting: vi.fn(),
  listForPrintingIds: vi.fn(async (): Promise<{ channelSlug: string }[]> => []),
};

const mockScheduler = { runNow: vi.fn() };
let scheduler: typeof mockScheduler | undefined = mockScheduler;

const mockTrxMut = {
  acceptNewCardFromSources: vi.fn(),
  createNameAliases: vi.fn(),
};

const mockImportErrata = vi.mocked(importErrata);
const mockIngestCandidates = vi.mocked(ingestCandidates);
const mockIo = { fetch: vi.fn() };
const mockSets = { getBySlug: vi.fn() };
const mockRefreshCatalogViews = vi.fn();
const mockCandidateCards = {
  cardNameKeys: vi.fn(),
  providersForCandidateCards: vi.fn(),
  providersForCandidatePrintings: vi.fn(),
  checkCandidateCard: vi.fn(),
  uncheckCandidateCard: vi.fn(),
  uncheckCandidateCards: vi.fn(),
  checkAllCandidatePrintings: vi.fn(),
  checkCandidatePrintingsOfCard: vi.fn(),
  dismissCandidateValue: vi.fn(),
  restoreCandidateValue: vi.fn(),
  checkCandidatePrinting: vi.fn(),
  uncheckCandidatePrinting: vi.fn(),
  uncheckCandidatePrintings: vi.fn(),
  checkAllCandidateCards: vi.fn(),
  patchCandidatePrinting: vi.fn(),
  deleteCandidatePrinting: vi.fn(),
  getCandidatePrintingById: vi.fn(),
  copyCandidatePrinting: vi.fn(),
  linkCandidatePrintings: vi.fn(),
  upsertPrintingLinkOverrides: vi.fn(),
  removePrintingLinkOverrides: vi.fn(),
  checkByProvider: vi.fn(),
  deleteByProvider: vi.fn(),
  reviewStateForCandidates: vi.fn(async () => new Map()),
  proposalForCandidate: vi.fn(async () => null),
};

const mockProviderSettings = {
  favoriteProviders: vi.fn(async () => new Set(["gallery"])),
  remove: vi.fn(),
};
const trxRepos = () => ({
  catalogMutations: mockTrxMut,
  printingImages: {} as object,
  candidateCards: mockCandidateCards,
  providerSettings: mockProviderSettings,
});
const mockTransact = vi.fn(async (cb: (repos: ReturnType<typeof trxRepos>) => Promise<unknown>) =>
  cb(trxRepos()),
);

const mockResolveCheckedSubmissions = vi.mocked(resolveCheckedSubmissions);
const mockNotifySubmitterOfCardAcceptance = vi.fn(async () => {});

const mockCardSubmissions = {
  pendingByProvider: vi.fn(async () => []),
};

const USER_ID = "a0000000-0001-4000-a000-000000000001";

const routeRepos = () => ({
  catalogMutations: mockMut,
  catalogDeleteGuards: mockCatalogDeleteGuards,
  cardErrata: mockCardErrata,
  keywords: { ...mockKeywords, listCostKeywords: vi.fn().mockResolvedValue(["Equip", "Repeat"]) },
  adminEvents: mockAdminEvents,
  candidateCards: mockCandidateCards,
  cardSubmissions: mockCardSubmissions,
  printingImages: {},
  markers: { listBySlugs: vi.fn(async () => []), setForPrinting: vi.fn() },
  providerSettings: mockProviderSettings,
  catalog: {
    refreshCatalogViews: mockRefreshCatalogViews,
    refreshCanonicalRank: vi.fn(),
    refreshCardAggregates: vi.fn(),
  },
  cardTokens: { recomputeForCard: vi.fn(), recomputeForPrintingCard: vi.fn() },
  sets: mockSets,
  distributionChannels: mockDistributionChannels,
  printingEvents: { recordNewPrinting: vi.fn(), recordPrintingChange: vi.fn() },
  rarities: {
    listAll: vi
      .fn()
      .mockResolvedValue([{ slug: "common" }, { slug: "uncommon" }, { slug: "rare" }]),
  },
});

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: USER_ID } as never);
  c.set("adminAccess", { isAdmin: true, sections: [] });
  c.set("io", mockIo as never);
  c.set("transact", mockTransact as never);
  c.set("scheduler", scheduler as never);
  c.set("repos", routeRepos() as never);
  c.set("services", {
    notifySubmitterOfCardAcceptance: mockNotifySubmitterOfCardAcceptance,
  } as never);
  await next();
});
registerRouterForTest(app, adminCardMutationsRouter);

const CARD_ID = "00000000-0000-4000-a000-000000000010";
const CP_ID = "00000000-0000-4000-a000-000000000011";
const CARD_ID2 = "00000000-0000-4000-a000-000000000012";
const PRINTING_ID = "00000000-0000-4000-a000-000000000013";

describe("POST /cards/:candidateCardId/check", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 204 on success", async () => {
    mockCandidateCards.checkCandidateCard.mockResolvedValue({ numUpdatedRows: 1n });

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/check`, { method: "POST" });
    expect(res.status).toBe(204);
    expect(mockCandidateCards.checkCandidateCard).toHaveBeenCalledWith(CARD_ID);
  });

  it("thanks the submitter of each submission the check accepted", async () => {
    mockCandidateCards.checkCandidateCard.mockResolvedValue({ numUpdatedRows: 1n });
    mockResolveCheckedSubmissions.mockResolvedValue(["sub-1", "sub-2"]);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/check`, { method: "POST" });

    expect(res.status).toBe(204);
    expect(mockResolveCheckedSubmissions).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ candidateCardIds: [CARD_ID], adminUserId: USER_ID }),
    );
    expect(mockNotifySubmitterOfCardAcceptance.mock.calls.map((call) => call.at(1))).toEqual([
      "sub-1",
      "sub-2",
    ]);
  });

  it("answers the check without waiting for the thank-you emails to go out", async () => {
    mockCandidateCards.checkCandidateCard.mockResolvedValue({ numUpdatedRows: 1n });
    mockResolveCheckedSubmissions.mockResolvedValue(["sub-1", "sub-2"]);
    mockNotifySubmitterOfCardAcceptance.mockReturnValue(Promise.withResolvers<void>().promise);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/check`, { method: "POST" });

    expect(res.status).toBe(204);
    expect(mockNotifySubmitterOfCardAcceptance).toHaveBeenCalledTimes(2);
  });

  it("sends no thank-you when the check accepted nothing", async () => {
    mockCandidateCards.checkCandidateCard.mockResolvedValue({ numUpdatedRows: 1n });

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/check`, { method: "POST" });

    expect(res.status).toBe(204);
    expect(mockNotifySubmitterOfCardAcceptance).not.toHaveBeenCalled();
  });

  it("records the check", async () => {
    mockCandidateCards.checkCandidateCard.mockResolvedValue({ numUpdatedRows: 1n });

    await app.request(`/api/admin/v1/cards/${CARD_ID}/check`, { method: "POST" });

    expect(mockAdminEvents.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        action: "candidate-card.check",
        entityType: "candidate-card",
        entityId: CARD_ID,
        newValues: { candidateCardIds: [CARD_ID] },
      }),
    ]);
  });

  it("returns 404 when result is null", async () => {
    mockCandidateCards.checkCandidateCard.mockResolvedValue(null);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/check`, { method: "POST" });
    expect(res.status).toBe(404);
  });
});

describe("POST /cards/:candidateCardId/uncheck", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 204 on success", async () => {
    mockCandidateCards.uncheckCandidateCard.mockResolvedValue({ numUpdatedRows: 1n });

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/uncheck`, { method: "POST" });
    expect(res.status).toBe(204);
    expect(mockCandidateCards.uncheckCandidateCard).toHaveBeenCalledWith(CARD_ID);
  });
});

describe("POST /cards/candidate-printings/uncheck-batch", () => {
  const URL = "/api/admin/v1/cards/candidate-printings/uncheck-batch";
  const post = (candidatePrintingIds: string[]) =>
    app.request(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidatePrintingIds }),
    });

  beforeEach(() => {
    vi.resetAllMocks();
    mockTransact.mockImplementation(async (cb) => cb(trxRepos()));
  });

  it("unchecks every given candidate printing in one transaction", async () => {
    mockCandidateCards.uncheckCandidatePrintings.mockResolvedValue(2);

    const res = await post([CP_ID, PRINTING_ID, CP_ID]);

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ updated: 2 });
    expect(mockTransact).toHaveBeenCalledOnce();
    expect(mockCandidateCards.uncheckCandidatePrintings).toHaveBeenCalledWith([CP_ID, PRINTING_ID]);
  });

  it("answers 404 and rolls back when one id has no row", async () => {
    mockCandidateCards.uncheckCandidatePrintings.mockResolvedValue(1);
    let rolledBack = false;
    mockTransact.mockImplementation(async (cb) => {
      const result = cb(trxRepos());
      await result.catch(() => {
        rolledBack = true;
      });
      return result;
    });

    const res = await post([CP_ID, PRINTING_ID]);

    expect(res.status).toBe(404);
    expect(rolledBack).toBe(true);
  });

  it("rejects an empty id list", async () => {
    const res = await post([]);
    expect(res.status).toBe(400);
    expect(mockCandidateCards.uncheckCandidatePrintings).not.toHaveBeenCalled();
  });

  it("rejects a list longer than one batch", async () => {
    const res = await post(Array.from({ length: 1001 }, () => CP_ID));
    expect(res.status).toBe(400);
    expect(mockCandidateCards.uncheckCandidatePrintings).not.toHaveBeenCalled();
  });
});

describe("POST /cards/candidate-cards/uncheck-batch", () => {
  const post = (candidateCardIds: string[]) =>
    app.request("/api/admin/v1/cards/candidate-cards/uncheck-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateCardIds }),
    });

  beforeEach(() => {
    vi.resetAllMocks();
    mockTransact.mockImplementation(async (cb) => cb(trxRepos()));
  });

  it("unchecks every given candidate card once, in one transaction, and records it", async () => {
    mockCandidateCards.uncheckCandidateCards.mockResolvedValue(2);

    const res = await post([CARD_ID, CARD_ID2, CARD_ID]);

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ updated: 2 });
    expect(mockTransact).toHaveBeenCalledOnce();
    expect(mockCandidateCards.uncheckCandidateCards).toHaveBeenCalledWith([CARD_ID, CARD_ID2]);
    expect(mockAdminEvents.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        action: "candidate-card.uncheck",
        entityId: null,
        newValues: { candidateCardIds: [CARD_ID, CARD_ID2] },
      }),
    ]);
  });

  it("answers 404 and rolls back when one id has no row", async () => {
    mockCandidateCards.uncheckCandidateCards.mockResolvedValue(1);
    let rolledBack = false;
    mockTransact.mockImplementation(async (cb) => {
      const result = cb(trxRepos());
      await result.catch(() => {
        rolledBack = true;
      });
      return result;
    });

    const res = await post([CARD_ID, CARD_ID2]);

    expect(res.status).toBe(404);
    expect(rolledBack).toBe(true);
    expect(mockAdminEvents.insertMany).not.toHaveBeenCalled();
  });

  it("rejects an empty id list", async () => {
    const res = await post([]);
    expect(res.status).toBe(400);
    expect(mockCandidateCards.uncheckCandidateCards).not.toHaveBeenCalled();
  });

  it("rejects a list longer than one batch", async () => {
    const res = await post(Array.from({ length: 1001 }, () => CARD_ID));
    expect(res.status).toBe(400);
    expect(mockCandidateCards.uncheckCandidateCards).not.toHaveBeenCalled();
  });
});

describe("POST /cards/candidate-values/dismiss", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("records the dismissed value on the source row", async () => {
    mockCandidateCards.dismissCandidateValue.mockResolvedValue(true);

    const res = await app.request("/api/admin/v1/cards/candidate-values/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "printing",
        candidateId: CP_ID,
        field: "artist",
        value: "Kudos",
      }),
    });

    expect(res.status).toBe(204);
    expect(mockAdminEvents.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        action: "candidate-printing.dismiss-value",
        entityType: "candidate-printing",
        entityId: CP_ID,
        newValues: { field: "artist", value: "Kudos" },
      }),
    ]);
  });

  it("records nothing for a missing source row", async () => {
    mockCandidateCards.dismissCandidateValue.mockResolvedValue(false);

    const res = await app.request("/api/admin/v1/cards/candidate-values/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "card", candidateId: CP_ID, field: "might", value: 3 }),
    });

    expect(res.status).toBe(404);
    expect(mockAdminEvents.insertMany).not.toHaveBeenCalled();
  });
});

describe("POST /cards/candidate-printings/check-all", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 200 with updated count", async () => {
    mockCandidateCards.checkAllCandidatePrintings.mockResolvedValue({
      updated: 5,
      ids: ["cp-1"],
      candidateCardIds: ["cc-1"],
    });

    const res = await app.request("/api/admin/v1/cards/candidate-printings/check-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        printingId: "a0000000-0000-4000-a000-0000000000a1",
        extraIds: ["a0000000-0000-4000-a000-0000000000e1", "a0000000-0000-4000-a000-0000000000e2"],
      }),
    });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual({ updated: 5 });
    expect(mockCandidateCards.checkAllCandidatePrintings).toHaveBeenCalledWith(
      "a0000000-0000-4000-a000-0000000000a1",
      ["a0000000-0000-4000-a000-0000000000e1", "a0000000-0000-4000-a000-0000000000e2"],
    );
  });

  it("works without optional fields", async () => {
    mockCandidateCards.checkAllCandidatePrintings.mockResolvedValue({
      updated: 0,
      ids: [],
      candidateCardIds: [],
    });

    const res = await app.request("/api/admin/v1/cards/candidate-printings/check-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual({ updated: 0 });
  });
});

describe("POST /cards/candidate-printings/:id/check", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 204 on success", async () => {
    mockCandidateCards.checkCandidatePrinting.mockResolvedValue({ candidateCardId: "cc-1" });

    const res = await app.request(`/api/admin/v1/cards/candidate-printings/${CP_ID}/check`, {
      method: "POST",
    });
    expect(res.status).toBe(204);
    expect(mockCandidateCards.checkCandidatePrinting).toHaveBeenCalledWith(CP_ID);
  });
});

describe("POST /cards/candidate-printings/:id/uncheck", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 204 on success", async () => {
    mockCandidateCards.uncheckCandidatePrinting.mockResolvedValue({ numUpdatedRows: 1n });

    const res = await app.request(`/api/admin/v1/cards/candidate-printings/${CP_ID}/uncheck`, {
      method: "POST",
    });
    expect(res.status).toBe(204);
    expect(mockCandidateCards.uncheckCandidatePrinting).toHaveBeenCalledWith(CP_ID);
  });
});

describe("POST /cards/:cardId/check-all", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockTransact.mockImplementation(async (cb) => cb(trxRepos()));
    mockMut.getCardById.mockResolvedValue({
      id: "card-uuid",
      name: "Fire Dragon",
      slug: "fire-dragon",
    });
    mockCandidateCards.cardNameKeys.mockResolvedValue(["firedragon", "firedragonalt"]);
  });

  it("returns 200 with updated count", async () => {
    mockCandidateCards.checkAllCandidateCards.mockResolvedValue({
      updated: 3,
      candidateCardIds: ["cc-1"],
    });

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/check-all`, { method: "POST" });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual({ updated: 3, candidateCardIds: ["cc-1"] });
    expect(mockCandidateCards.cardNameKeys).toHaveBeenCalledWith("card-uuid");
    expect(mockCandidateCards.checkAllCandidateCards).toHaveBeenCalledWith(
      ["firedragon", "firedragonalt"],
      "card-uuid",
      undefined,
    );
  });

  it("checks only the given candidate card ids among the card's own", async () => {
    mockCandidateCards.checkAllCandidateCards.mockResolvedValue({
      updated: 1,
      candidateCardIds: [CARD_ID],
    });

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/check-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateCardIds: [CARD_ID] }),
    });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ updated: 1, candidateCardIds: [CARD_ID] });
    expect(mockCandidateCards.checkAllCandidateCards).toHaveBeenCalledWith(
      ["firedragon", "firedragonalt"],
      "card-uuid",
      [CARD_ID],
    );
  });

  it("answers 404 and rolls back when a given id belongs to another card", async () => {
    mockCandidateCards.checkAllCandidateCards.mockResolvedValue({
      updated: 1,
      candidateCardIds: [CARD_ID],
    });
    let rolledBack = false;
    mockTransact.mockImplementation(async (cb) => {
      const result = cb(trxRepos());
      await result.catch(() => {
        rolledBack = true;
      });
      return result;
    });

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/check-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateCardIds: [CARD_ID, CP_ID] }),
    });
    expect(res.status).toBe(404);
    expect(rolledBack).toBe(true);
    expect(mockResolveCheckedSubmissions).not.toHaveBeenCalled();
  });
});

describe("POST /cards/:cardId/check-pass", () => {
  const post = (body: object) =>
    app.request(`/api/admin/v1/cards/${CARD_ID2}/check-pass`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  beforeEach(() => {
    vi.resetAllMocks();
    mockTransact.mockImplementation(async (cb) => cb(trxRepos()));
    mockMut.getCardById.mockResolvedValue({
      id: "card-uuid",
      name: "Fire Dragon",
      slug: "fire-dragon",
    });
    mockCandidateCards.cardNameKeys.mockResolvedValue(["firedragon"]);
    mockCandidateCards.providersForCandidateCards.mockResolvedValue([]);
    mockCandidateCards.providersForCandidatePrintings.mockResolvedValue([]);
    mockResolveCheckedSubmissions.mockResolvedValue([]);
  });

  it("refuses a contributor source and checks nothing", async () => {
    mockCandidateCards.providersForCandidatePrintings.mockResolvedValue([
      { id: CP_ID, provider: USER_SUBMISSION_PROVIDER },
    ]);

    const res = await post({ candidateCardIds: [CARD_ID], candidatePrintingIds: [CP_ID] });

    expect(res.status).toBe(400);
    expect(mockTransact).not.toHaveBeenCalled();
    expect(mockResolveCheckedSubmissions).not.toHaveBeenCalled();
  });

  it("checks the card and printing sources in one transaction and records both", async () => {
    mockCandidateCards.checkAllCandidateCards.mockResolvedValue({
      updated: 1,
      candidateCardIds: [CARD_ID],
    });
    mockCandidateCards.checkCandidatePrintingsOfCard.mockResolvedValue({
      updated: 1,
      matchedIds: [CP_ID],
      candidateCardIds: ["cc-printing"],
    });

    const res = await post({ candidateCardIds: [CARD_ID], candidatePrintingIds: [CP_ID, CP_ID] });

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ cardsUpdated: 1, printingsUpdated: 1 });
    expect(mockTransact).toHaveBeenCalledOnce();
    expect(mockCandidateCards.checkCandidatePrintingsOfCard).toHaveBeenCalledWith(
      ["firedragon"],
      "card-uuid",
      [CP_ID],
    );
    expect(mockResolveCheckedSubmissions).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ candidateCardIds: [CARD_ID, "cc-printing"] }),
    );
    expect(mockAdminEvents.insertMany.mock.calls.flatMap((call) => call[0])).toEqual([
      expect.objectContaining({
        action: "candidate-card.check",
        cardSlug: "fire-dragon",
        newValues: { candidateCardIds: [CARD_ID] },
      }),
      expect.objectContaining({
        action: "candidate-printing.check",
        cardSlug: "fire-dragon",
        newValues: { candidatePrintingIds: [CP_ID] },
      }),
    ]);
  });

  it("answers 404 and rolls back the card checks when a printing belongs to another card", async () => {
    mockCandidateCards.checkAllCandidateCards.mockResolvedValue({
      updated: 1,
      candidateCardIds: [CARD_ID],
    });
    mockCandidateCards.checkCandidatePrintingsOfCard.mockResolvedValue({
      updated: 0,
      matchedIds: [],
      candidateCardIds: [],
    });
    let rolledBack = false;
    mockTransact.mockImplementation(async (cb) => {
      const result = cb(trxRepos());
      await result.catch(() => {
        rolledBack = true;
      });
      return result;
    });

    const res = await post({ candidateCardIds: [CARD_ID], candidatePrintingIds: [CP_ID] });

    expect(res.status).toBe(404);
    expect(rolledBack).toBe(true);
    expect(mockAdminEvents.insertMany).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown card", async () => {
    mockMut.getCardById.mockResolvedValue(undefined);
    const res = await post({ candidateCardIds: [CARD_ID], candidatePrintingIds: [] });
    expect(res.status).toBe(404);
    expect(mockTransact).not.toHaveBeenCalled();
  });

  it("rejects a pass with nothing to check", async () => {
    const res = await post({ candidateCardIds: [], candidatePrintingIds: [] });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /cards/candidate-printings/:id", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 204 on successful patch", async () => {
    mockCandidateCards.patchCandidatePrinting.mockResolvedValue({ numUpdatedRows: 1n });

    const res = await app.request(`/api/admin/v1/cards/candidate-printings/${CP_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artVariant: "alternate", finish: "foil" }),
    });
    expect(res.status).toBe(204);
    expect(mockCandidateCards.patchCandidatePrinting).toHaveBeenCalledWith(CP_ID, {
      artVariant: "alternate",
      finish: "foil",
    });
  });

  it("re-resolves the edited row's link inside the patch transaction", async () => {
    const before = { id: CP_ID, shortCode: "OGN-001", finish: "normal" };
    mockCandidateCards.getCandidatePrintingById.mockResolvedValue(before);
    mockCandidateCards.patchCandidatePrinting.mockResolvedValue({ numUpdatedRows: 1n });

    const res = await app.request(`/api/admin/v1/cards/candidate-printings/${CP_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finish: "foil" }),
    });

    expect(res.status).toBe(204);
    expect(mockTransact).toHaveBeenCalledOnce();
    expect(vi.mocked(reresolveEditedCandidateLink)).toHaveBeenCalledWith(
      expect.objectContaining({ candidateCards: mockCandidateCards }),
      CP_ID,
      before,
    );
  });

  it("returns 400 when no valid fields provided", async () => {
    const res = await app.request(`/api/admin/v1/cards/candidate-printings/${CP_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.message).toContain("No valid fields");
  });
});

describe("DELETE /cards/candidate-printings/:id", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 204 on success", async () => {
    mockCandidateCards.deleteCandidatePrinting.mockResolvedValue(true);

    const res = await app.request(`/api/admin/v1/cards/candidate-printings/${CP_ID}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
    expect(mockCandidateCards.deleteCandidatePrinting).toHaveBeenCalledWith(CP_ID);
  });
});

describe("POST /cards/candidate-printings/:id/copy", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 204 on successful copy", async () => {
    const candidatePrinting = {
      id: "a0000000-0000-4000-a000-0000000000c1",
      name: "Fire Dragon",
      shortCode: "OGN-T05",
    };
    const targetPrinting = {
      id: "a0000000-0000-4000-a000-0000000000a2",
      slug: "a0000000-0000-4000-a000-0000000000a2",
    };
    mockCandidateCards.getCandidatePrintingById.mockResolvedValue(candidatePrinting);
    mockMut.getPrintingDifferentiatorsById.mockResolvedValue(targetPrinting);
    mockCandidateCards.copyCandidatePrinting.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/candidate-printings/${CP_ID}/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ printingId: "a0000000-0000-4000-a000-0000000000a2" }),
    });
    expect(res.status).toBe(204);
    expect(mockMut.getPrintingDifferentiatorsById).toHaveBeenCalledWith(
      "a0000000-0000-4000-a000-0000000000a2",
      "OGN-T05",
    );
    expect(mockCandidateCards.copyCandidatePrinting).toHaveBeenCalledWith(
      candidatePrinting,
      targetPrinting,
    );
  });

  it("returns 404 when candidate printing not found", async () => {
    mockCandidateCards.getCandidatePrintingById.mockResolvedValue(null);

    const res = await app.request(`/api/admin/v1/cards/candidate-printings/${CP_ID}/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ printingId: "a0000000-0000-4000-a000-0000000000a2" }),
    });
    expect(res.status).toBe(404);
    const json = await readJson(res);
    expect(json.message).toContain("Candidate printing not found");
  });

  it("returns 404 when target printing not found", async () => {
    mockCandidateCards.getCandidatePrintingById.mockResolvedValue({
      id: "a0000000-0000-4000-a000-0000000000c1",
    });
    mockMut.getPrintingDifferentiatorsById.mockResolvedValue(null);

    const res = await app.request(`/api/admin/v1/cards/candidate-printings/${CP_ID}/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ printingId: "a0000000-0000-4000-a000-0000000000a3" }),
    });
    expect(res.status).toBe(404);
    const json = await readJson(res);
    expect(json.message).toContain("Target printing not found");
  });
});

describe("POST /cards/candidate-printings/link", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 204 and upserts link overrides when linking", async () => {
    mockCandidateCards.linkCandidatePrintings.mockResolvedValue(undefined);
    mockCandidateCards.upsertPrintingLinkOverrides.mockResolvedValue(undefined);

    const res = await app.request("/api/admin/v1/cards/candidate-printings/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidatePrintingIds: [
          "a0000000-0000-4000-a000-0000000000c1",
          "a0000000-0000-4000-a000-0000000000c2",
        ],
        printingId: "a0000000-0000-4000-a000-0000000000a1",
      }),
    });
    expect(res.status).toBe(204);
    expect(mockCandidateCards.linkCandidatePrintings).toHaveBeenCalledWith(
      ["a0000000-0000-4000-a000-0000000000c1", "a0000000-0000-4000-a000-0000000000c2"],
      "a0000000-0000-4000-a000-0000000000a1",
    );
    expect(mockCandidateCards.upsertPrintingLinkOverrides).toHaveBeenCalledWith(
      ["a0000000-0000-4000-a000-0000000000c1", "a0000000-0000-4000-a000-0000000000c2"],
      "a0000000-0000-4000-a000-0000000000a1",
    );
  });

  it("removes link overrides when unlinking (printingId is null)", async () => {
    mockCandidateCards.linkCandidatePrintings.mockResolvedValue(undefined);
    mockCandidateCards.removePrintingLinkOverrides.mockResolvedValue(undefined);

    const res = await app.request("/api/admin/v1/cards/candidate-printings/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidatePrintingIds: ["a0000000-0000-4000-a000-0000000000c1"],
        printingId: null,
      }),
    });
    expect(res.status).toBe(204);
    expect(mockCandidateCards.removePrintingLinkOverrides).toHaveBeenCalledWith([
      "a0000000-0000-4000-a000-0000000000c1",
    ]);
  });

  it("returns 400 when candidatePrintingIds is empty", async () => {
    const res = await app.request("/api/admin/v1/cards/candidate-printings/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidatePrintingIds: [],
        printingId: "a0000000-0000-4000-a000-0000000000a1",
      }),
    });
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.message).toContain("candidatePrintingIds[] required");
  });
});

describe("POST /cards/:cardId/rename", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 204 on successful rename", async () => {
    mockMut.getCardById.mockResolvedValue({
      id: "a0000000-0000-4000-a000-0000000000d1",
      name: "Fire Dragon",
      slug: "fire-dragon",
    });
    mockMut.renameCardSlugById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newId: "flame-drake" }),
    });
    expect(res.status).toBe(204);
    expect(mockMut.renameCardSlugById).toHaveBeenCalledWith(
      "a0000000-0000-4000-a000-0000000000d1",
      "flame-drake",
    );
  });

  it("answers a rename onto a taken slug with a 409", async () => {
    mockMut.getCardById.mockResolvedValue({
      id: "a0000000-0000-4000-a000-0000000000d1",
      name: "Fire Dragon",
      slug: "fire-dragon",
    });
    mockMut.renameCardSlugById.mockRejectedValue(
      Object.assign(new Error("duplicate key"), {
        code: "23505",
        constraint_name: "uq_cards_slug",
      }),
    );

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newId: "flame-drake" }),
    });
    expect(res.status).toBe(409);
    expect(await readJson(res)).toMatchObject({ message: "A card with this slug already exists" });
  });

  it("returns 204 without renaming when newId matches current slug", async () => {
    mockMut.getCardById.mockResolvedValue({
      id: "a0000000-0000-4000-a000-0000000000d1",
      name: "Fire Dragon",
      slug: "fire-dragon",
    });

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newId: "fire-dragon" }),
    });
    expect(res.status).toBe(204);
    expect(mockMut.renameCardSlugById).not.toHaveBeenCalled();
  });

  it("returns 404 when card not found", async () => {
    mockMut.getCardById.mockResolvedValue(null);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newId: "flame-drake" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 when newId is empty", async () => {
    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newId: "  " }),
    });
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.message).toContain("newId is required");
  });
});

describe("DELETE /cards/printing/:printingId", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 204 on successful deletion", async () => {
    mockDeletePrinting.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
    expect(mockDeletePrinting).toHaveBeenCalledWith(
      mockTransact,
      mockIo,
      expect.objectContaining({ catalogMutations: mockMut }),
      PRINTING_ID,
    );
  });
});

describe("POST /cards/by-provider/:provider/check", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 200 with check result", async () => {
    mockCandidateCards.checkByProvider.mockResolvedValue({
      cardsChecked: 10,
      printingsChecked: 20,
    });

    const res = await app.request("/api/admin/v1/cards/by-provider/tcgplayer/check", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual({ cardsChecked: 10, printingsChecked: 20 });
    expect(mockCandidateCards.checkByProvider).toHaveBeenCalledWith("tcgplayer", expect.any(Date));
  });

  it("returns 400 when provider is empty (decoded blank)", async () => {
    const res = await app.request("/api/admin/v1/cards/by-provider/%20/check", { method: "POST" });
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.message).toContain("Provider name is required");
  });
});

describe("DELETE /cards/by-provider/:provider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 200 with delete result", async () => {
    mockCandidateCards.deleteByProvider.mockResolvedValue(15);

    const res = await app.request("/api/admin/v1/cards/by-provider/tcgplayer", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual({ provider: "tcgplayer", deleted: 15 });
    expect(mockCandidateCards.deleteByProvider).toHaveBeenCalledWith("tcgplayer");
  });

  it("drops the provider settings row so the source leaves the list", async () => {
    mockCandidateCards.deleteByProvider.mockResolvedValue(0);

    const res = await app.request("/api/admin/v1/cards/by-provider/skeleton-fr", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ provider: "skeleton-fr", deleted: 0 });
    expect(mockProviderSettings.remove).toHaveBeenCalledWith("skeleton-fr");
  });

  it("returns 400 when provider is empty (decoded blank)", async () => {
    const res = await app.request("/api/admin/v1/cards/by-provider/%20", { method: "DELETE" });
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.message).toContain("Provider name is required");
  });
});

describe("POST /cards/:cardId/errata", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("keeps keywords on the English errata when a French one is saved", async () => {
    mockCardErrata.upsert.mockResolvedValue(undefined);
    mockCardErrata.get.mockResolvedValue({
      announcementId: null,
      correctedRulesText: "[Tank]",
      correctedEffectText: null,
      source: "official",
      sourceUrl: null,
      effectiveDate: null,
    } as never);
    mockMut.getPrintingTextsForCardId.mockResolvedValue([]);
    mockMut.updateCardById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/errata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: "FR",
        correctedRulesText: "[Caché]",
        correctedEffectText: null,
        source: "official",
      }),
    });
    expect(res.status).toBe(204);
    expect(mockCardErrata.upsert).toHaveBeenCalledWith(CARD_ID2, "FR", expect.any(Object));
    expect(mockMut.updateCardById).toHaveBeenCalledWith(CARD_ID2, { keywords: ["Tank"] });
  });

  it("upserts errata and recomputes keywords (204)", async () => {
    mockCardErrata.upsert.mockResolvedValue(undefined);
    mockMut.getPrintingTextsForCardId.mockResolvedValue([]);
    mockMut.updateCardById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/errata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: "EN",
        correctedRulesText: "Deal 4 damage.",
        correctedEffectText: null,
        source: "official",
      }),
    });
    expect(res.status).toBe(204);
    expect(mockCardErrata.upsert).toHaveBeenCalledWith(
      CARD_ID2,
      "EN",
      expect.objectContaining({ correctedRulesText: "Deal 4 damage.", source: "official" }),
    );
    expect(mockMut.updateCardById).toHaveBeenCalledWith(
      CARD_ID2,
      expect.objectContaining({ keywords: expect.any(Array) }),
    );
  });
});

describe("POST /cards/:cardId/errata with an announcement", () => {
  const ANNOUNCEMENT_ID = "019f2a10-5c1e-7d4f-9a62-1b3c4d5e6f70";

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("links the errata to the announcement and stores no source note", async () => {
    mockCardErrata.upsert.mockResolvedValue(undefined);
    mockMut.getPrintingTextsForCardId.mockResolvedValue([]);
    mockMut.updateCardById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/errata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: "EN",
        announcementId: ANNOUNCEMENT_ID,
        correctedRulesText: "Deal 4 damage.",
        correctedEffectText: null,
      }),
    });
    expect(res.status).toBe(204);
    expect(mockCardErrata.upsert).toHaveBeenCalledWith(
      CARD_ID2,
      "EN",
      expect.objectContaining({ announcementId: ANNOUNCEMENT_ID, source: null }),
    );
  });

  it("rejects an announcement combined with a source note", async () => {
    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/errata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: "EN",
        announcementId: ANNOUNCEMENT_ID,
        correctedRulesText: "Deal 4 damage.",
        correctedEffectText: null,
        source: "official",
      }),
    });
    expect(res.status).toBe(400);
    expect(mockCardErrata.upsert).not.toHaveBeenCalled();
  });

  it("rejects errata with neither an announcement nor a source", async () => {
    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/errata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: "EN",
        correctedRulesText: "Deal 4 damage.",
        correctedEffectText: null,
      }),
    });
    expect(res.status).toBe(400);
    expect(mockCardErrata.upsert).not.toHaveBeenCalled();
  });
});

describe("DELETE /cards/:cardId/errata", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("deletes errata and recomputes keywords (204)", async () => {
    mockCardErrata.delete.mockResolvedValue(undefined);
    mockMut.getPrintingTextsForCardId.mockResolvedValue([]);
    mockMut.updateCardById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/errata`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "FR" }),
    });
    expect(res.status).toBe(204);
    expect(mockCardErrata.delete).toHaveBeenCalledWith(CARD_ID2, "FR");
    expect(mockMut.updateCardById).toHaveBeenCalledWith(
      CARD_ID2,
      expect.objectContaining({ keywords: expect.any(Array) }),
    );
  });
});

describe("POST /cards/errata/upload", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("imports errata and returns the summary", async () => {
    const summary = {
      dryRun: true,
      newCount: 1,
      updatedCount: 0,
      unchangedCount: 0,
      matchesPrintedCount: 0,
      errors: [],
      newEntries: [{ cardSlug: "jinx-rebel", cardName: "Jinx, Rebel", language: "EN" }],
      updatedEntries: [],
      skippedMatchesPrinted: [],
      newAnnouncements: [],
      changedAnnouncements: [],
    };
    mockImportErrata.mockResolvedValue(summary);

    const res = await app.request("/api/admin/v1/cards/errata/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dryRun: true,
        entries: [
          { cardSlug: "jinx-rebel", correctedRulesText: "Deal 4 damage.", source: "official" },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual(summary);
    expect(mockImportErrata).toHaveBeenCalledWith(
      mockTransact,
      expect.objectContaining({ dryRun: true }),
    );
  });

  it("rejects an empty entries array", async () => {
    const res = await app.request("/api/admin/v1/cards/errata/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun: false, entries: [] }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /cards/:cardId/accept-field", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFixTypography.mockImplementation((text: string | null) => text);
    mockMut.getPrintingTextsForCardId.mockResolvedValue([]);
    mockKeywords.recomputeForPrintingCard.mockResolvedValue(undefined);
  });

  it("updates the card field and answers that it wrote", async () => {
    mockMut.updateCardById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "name", value: "Flame Drake" }),
    });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ written: true });
    expect(mockMut.updateCardById).toHaveBeenCalledWith(CARD_ID2, { name: "Flame Drake" });
  });

  it("writes nothing for domains equal to the card's, in the same order", async () => {
    mockMut.getCardDomainsById.mockResolvedValue(["fury", "calm"]);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "domains", value: ["fury", "calm"] }),
    });
    expect(await readJson(res)).toEqual({ written: false });
    expect(mockMut.replaceCardDomainsById).not.toHaveBeenCalled();
    expect(mockAdminEvents.insert).not.toHaveBeenCalled();
  });

  it("writes reordered domains, since their order is part of the card", async () => {
    mockMut.getCardDomainsById.mockResolvedValue(["fury", "calm"]);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "domains", value: ["calm", "fury"] }),
    });
    expect(await readJson(res)).toEqual({ written: true });
    expect(mockMut.replaceCardDomainsById).toHaveBeenCalledWith(CARD_ID2, ["calm", "fury"]);
  });

  it("normalizes null to empty array for superTypes (junction table)", async () => {
    mockMut.replaceCardSuperTypesById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "superTypes", value: null }),
    });
    expect(res.status).toBe(200);
    expect(mockMut.replaceCardSuperTypesById).toHaveBeenCalledWith(CARD_ID2, []);
  });

  it("normalizes null to empty array for tags field", async () => {
    mockMut.updateCardById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "tags", value: null }),
    });
    expect(res.status).toBe(200);
    expect(mockMut.updateCardById).toHaveBeenCalledWith(CARD_ID2, { tags: [] });
  });

  it("accepts might field with numeric value", async () => {
    mockMut.updateCardById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "might", value: 3 }),
    });
    expect(res.status).toBe(200);
    expect(mockMut.updateCardById).toHaveBeenCalledWith(CARD_ID2, { might: 3 });
  });

  it("rejects a name made only of punctuation", async () => {
    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "name", value: "!?!" }),
    });
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.message).toBe("Invalid value for name: needs at least one letter or digit");
    expect(mockMut.updateCardById).not.toHaveBeenCalled();
  });

  it("returns 400 (BAD_REQUEST) when a card field value fails the field rule", async () => {
    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "might", value: -5 }),
    });
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.code).toBe("BAD_REQUEST");
    expect(json.message).toContain("Invalid value for might");
  });

  it("writes an undo under the card's row lock while the field still holds the expected value", async () => {
    mockTransact.mockImplementationOnce(async (cb) => cb(routeRepos() as never));
    mockMut.getFullCardById.mockResolvedValue({ id: CARD_ID2, name: "Flame Drake", slug: "fd" });

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "name", value: "Ember Drake", expected: "Flame Drake" }),
    });
    expect(await readJson(res)).toEqual({ written: true });
    expect(mockMut.lockCardRow).toHaveBeenCalledWith(CARD_ID2);
    expect(mockMut.lockCardRow.mock.invocationCallOrder[0]).toBeLessThan(
      mockMut.getFullCardById.mock.invocationCallOrder[0] ?? 0,
    );
    expect(mockMut.updateCardById).toHaveBeenCalledWith(CARD_ID2, { name: "Ember Drake" });
  });

  it("answers FIELD_CHANGED and writes nothing when the field moved off the expected value", async () => {
    mockTransact.mockImplementationOnce(async (cb) => cb(routeRepos() as never));
    mockMut.getFullCardById.mockResolvedValue({ id: CARD_ID2, name: "Ashen Drake", slug: "ad" });

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "name", value: "Ember Drake", expected: "Flame Drake" }),
    });
    expect(res.status).toBe(409);
    expect(await readJson(res)).toMatchObject({ code: "FIELD_CHANGED" });
    expect(mockMut.updateCardById).not.toHaveBeenCalled();
    expect(mockAdminEvents.insert).not.toHaveBeenCalled();
  });

  it("answers unwritten when the field already holds the undo's value", async () => {
    mockTransact.mockImplementationOnce(async (cb) => cb(routeRepos() as never));
    mockMut.getFullCardById.mockResolvedValue({ id: CARD_ID2, name: "Ember Drake", slug: "ed" });

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "name", value: "Ember Drake", expected: "Flame Drake" }),
    });
    expect(await readJson(res)).toEqual({ written: false });
    expect(mockMut.updateCardById).not.toHaveBeenCalled();
  });

  it("compares an expected null against an emptied comment", async () => {
    mockTransact.mockImplementationOnce(async (cb) => cb(routeRepos() as never));
    mockMut.getFullCardById.mockResolvedValue({ id: CARD_ID2, name: "Ember", comment: null });

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "comment", value: "Errata pending", expected: null }),
    });
    expect(await readJson(res)).toEqual({ written: true });
  });
});

describe("POST /cards/printing/:printingId/accept-field", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFixTypography.mockImplementation((text: string | null) => text);
    mockAppendSetTotal.mockImplementation((code: string) => code);
    mockKeywords.recomputeForPrintingCard.mockResolvedValue(undefined);
    mockMut.getFullPrintingById.mockResolvedValue({
      id: "OGS-001",
      cardId: "card-uuid",
      setId: "set-uuid",
      shortCode: "OGS-001",
      rarity: "common",
      artVariant: "normal",
      isSigned: false,
      markerSlugs: [],
      finish: "normal",
      artist: "Original Artist",
      publicCode: "001",
      printedRulesText: null,
      printedEffectText: null,
      flavorText: null,
      comment: null,
      language: "EN",
      printedName: null,
      printedYear: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("returns 204 and updates printing field", async () => {
    mockMut.updatePrintingFieldById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "artist", value: "Alice" }),
    });
    expect(res.status).toBe(200);
    expect(mockMut.updatePrintingFieldById).toHaveBeenCalledWith(PRINTING_ID, "artist", "Alice", 1);
    expect(mockRefreshCatalogViews).not.toHaveBeenCalled();
  });

  it("refreshes the catalog views after a field the foil twins and ranks read", async () => {
    mockMut.updatePrintingFieldById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "finish", value: "foil" }),
    });
    expect(res.status).toBe(200);
    expect(mockRefreshCatalogViews).toHaveBeenCalledTimes(1);
  });

  it("files the audit event under the edited face's card", async () => {
    mockMut.updatePrintingFieldById.mockResolvedValue(undefined);
    mockMut.getCardById.mockResolvedValue({ id: "card-uuid", name: "Tentacle", slug: "tentacle" });

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "artist", value: "Alice", side: 2 }),
    });
    expect(res.status).toBe(200);
    expect(mockMut.getCardById).toHaveBeenCalledWith("card-uuid");
    expect(mockAdminEvents.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "printing.accept-field", cardSlug: "tentacle" }),
    );
  });

  it("writes to the side the face is on now, after a re-sort", async () => {
    mockMut.sideOfFace.mockResolvedValue(1);
    mockMut.updatePrintingFieldById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        field: "artist",
        value: "Alice",
        side: 2,
        faceId: "d0000000-0001-4000-a000-0000000000f1",
      }),
    });
    expect(res.status).toBe(200);
    expect(mockMut.updatePrintingFieldById).toHaveBeenCalledWith(PRINTING_ID, "artist", "Alice", 1);
  });

  it("writes to the second side when the row is side 2", async () => {
    mockMut.updatePrintingFieldById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "artist", value: "Alice", side: 2 }),
    });
    expect(res.status).toBe(200);
    expect(mockMut.getFullPrintingById).toHaveBeenCalledWith(PRINTING_ID, 2);
    expect(mockMut.updatePrintingFieldById).toHaveBeenCalledWith(PRINTING_ID, "artist", "Alice", 2);
  });

  it("writes nothing for a reordered set of marker slugs", async () => {
    mockMut.getFullPrintingById.mockResolvedValue({
      id: PRINTING_ID,
      cardId: "card-uuid",
      shortCode: "OGS-001",
      markerSlugs: ["foil", "promo"],
    });

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "markerSlugs", value: ["promo", "foil"] }),
    });
    expect(await readJson(res)).toEqual({ written: false });
    expect(mockUpdatePrintingMarkers).not.toHaveBeenCalled();
    expect(mockAdminEvents.insert).not.toHaveBeenCalled();
  });

  it("writes nothing for the distribution channels the printing already has", async () => {
    mockDistributionChannels.listForPrintingIds.mockResolvedValue([
      { channelSlug: "launch" },
      { channelSlug: "league" },
    ]);

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "distributionChannelSlugs", value: ["league", "launch"] }),
    });
    expect(await readJson(res)).toEqual({ written: false });
    expect(vi.mocked(updatePrintingDistributionChannels)).not.toHaveBeenCalled();
    expect(mockAdminEvents.insert).not.toHaveBeenCalled();
  });

  it("delegates to updatePrintingMarkers when field is markerSlugs", async () => {
    mockUpdatePrintingMarkers.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "markerSlugs", value: ["promo"] }),
    });
    expect(res.status).toBe(200);
    expect(mockUpdatePrintingMarkers).toHaveBeenCalledWith(mockTransact, PRINTING_ID, ["promo"], 1);
    expect(mockMut.updatePrintingFieldById).not.toHaveBeenCalled();
  });

  it("applies fixTypography for printedRulesText from provider", async () => {
    mockFixTypography.mockReturnValue("Fixed text");
    mockMut.updatePrintingFieldById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "printedRulesText", value: "Raw text", source: "provider" }),
    });
    expect(res.status).toBe(200);
    expect(mockFixTypography).toHaveBeenCalledWith("Raw text", {
      costKeywords: ["Equip", "Repeat"],
    });
    expect(mockMut.updatePrintingFieldById).toHaveBeenCalledWith(
      PRINTING_ID,
      "printedRulesText",
      "Fixed text",
      1,
    );
  });

  it("calls appendSetTotal for publicCode from provider", async () => {
    mockAppendSetTotal.mockReturnValue("OGS-001/100");
    mockMut.getSetPrintedTotalForPrinting.mockResolvedValue({ printedTotal: 100 });
    mockMut.updatePrintingFieldById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "publicCode", value: "OGS-001", source: "provider" }),
    });
    expect(res.status).toBe(200);
    expect(mockAppendSetTotal).toHaveBeenCalledWith("OGS-001", 100);
  });

  it("resolves setId slug to UUID", async () => {
    mockSets.getBySlug.mockResolvedValue({ id: "set-uuid-1" });
    mockMut.updatePrintingFieldById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "setId", value: "origin-set" }),
    });
    expect(res.status).toBe(200);
    expect(mockSets.getBySlug).toHaveBeenCalledWith("origin-set");
    expect(mockMut.updatePrintingFieldById).toHaveBeenCalledWith(
      PRINTING_ID,
      "setId",
      "set-uuid-1",
      1,
    );
  });

  it("writes and audits nothing when the slug names the printing's current set", async () => {
    mockSets.getBySlug.mockResolvedValue({ id: "set-uuid" });

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "setId", value: "origin-set" }),
    });
    expect(res.status).toBe(200);
    expect(mockMut.updatePrintingFieldById).not.toHaveBeenCalled();
    expect(mockAdminEvents.insert).not.toHaveBeenCalled();
    expect(mockRefreshCatalogViews).not.toHaveBeenCalled();
  });

  it("returns 404 when set slug not found", async () => {
    mockSets.getBySlug.mockResolvedValue(null);

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "setId", value: "nonexistent" }),
    });
    expect(res.status).toBe(404);
    const json = await readJson(res);
    expect(json.message).toContain("Set not found");
  });

  it("returns 400 (BAD_REQUEST) when a printing field value fails the field rule", async () => {
    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "rarity", value: "" }),
    });
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.code).toBe("BAD_REQUEST");
    expect(json.message).toContain("Invalid value for rarity");
  });

  it("locks the printing's side before reading it for an undo", async () => {
    mockTransact.mockImplementationOnce(async (cb) => cb(routeRepos() as never));

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        field: "artist",
        value: "Alice",
        side: 2,
        expected: "Original Artist",
      }),
    });
    expect(await readJson(res)).toEqual({ written: true });
    expect(mockMut.lockPrintingSide).toHaveBeenCalledWith(PRINTING_ID, 2);
    expect(mockMut.lockPrintingSide.mock.invocationCallOrder[0]).toBeLessThan(
      mockMut.getFullPrintingById.mock.invocationCallOrder.at(-1) ?? 0,
    );
    expect(mockMut.updatePrintingFieldById).toHaveBeenCalledWith(PRINTING_ID, "artist", "Alice", 2);
  });

  it("answers FIELD_CHANGED when another edit replaced the expected value", async () => {
    mockTransact.mockImplementationOnce(async (cb) => cb(routeRepos() as never));

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "artist", value: "Alice", expected: "Someone Else" }),
    });
    expect(res.status).toBe(409);
    expect(await readJson(res)).toMatchObject({ code: "FIELD_CHANGED" });
    expect(mockMut.updatePrintingFieldById).not.toHaveBeenCalled();
    expect(mockAdminEvents.insert).not.toHaveBeenCalled();
  });

  it("matches the expected value of a provider accept in its stored, typeset form", async () => {
    mockTransact.mockImplementationOnce(async (cb) => cb(routeRepos() as never));
    mockFixTypography.mockImplementation((text: string | null) => text?.replace("'", "’") ?? null);
    mockMut.getFullPrintingById.mockResolvedValue({
      id: PRINTING_ID,
      cardId: "card-uuid",
      shortCode: "OGS-001",
      printedRulesText: "It’s fine",
    });

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "printedRulesText", value: null, expected: "It's fine" }),
    });
    expect(await readJson(res)).toEqual({ written: true });
    expect(mockMut.updatePrintingFieldById).toHaveBeenCalledWith(
      PRINTING_ID,
      "printedRulesText",
      null,
      1,
    );
  });

  it("compares an expected set slug against the printing's set id", async () => {
    mockTransact.mockImplementationOnce(async (cb) => cb(routeRepos() as never));
    mockSets.getBySlug.mockImplementation(async (slug: string) =>
      slug === "origin-set" ? { id: "set-uuid" } : { id: "set-uuid-2" },
    );

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "setId", value: "spiritforged", expected: "origin-set" }),
    });
    expect(await readJson(res)).toEqual({ written: true });
    expect(mockMut.updatePrintingFieldById).toHaveBeenCalledWith(
      PRINTING_ID,
      "setId",
      "set-uuid-2",
      1,
    );
  });
});

describe("POST /cards/new/:name/accept", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockTransact.mockImplementation(async (cb) => cb(trxRepos()));
  });

  it("returns 204 on successful accept (name path param decoded)", async () => {
    mockTrxMut.acceptNewCardFromSources.mockResolvedValue(undefined);

    const res = await app.request("/api/admin/v1/cards/new/Fire%20Dragon/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardFields: { id: "fire-dragon", name: "Fire Dragon", types: ["unit"], domains: ["fury"] },
      }),
    });
    expect(res.status).toBe(204);
    expect(mockTrxMut.acceptNewCardFromSources).toHaveBeenCalledWith(
      expect.objectContaining({ id: "fire-dragon", name: "Fire Dragon" }),
      "Fire Dragon",
    );
  });

  it("stores the trimmed name on accept", async () => {
    mockTrxMut.acceptNewCardFromSources.mockResolvedValue(undefined);

    const res = await app.request("/api/admin/v1/cards/new/Fire%20Dragon/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardFields: {
          id: "fire-dragon",
          name: "  Fire Dragon ",
          types: ["unit"],
          domains: ["fury"],
        },
      }),
    });
    expect(res.status).toBe(204);
    expect(mockTrxMut.acceptNewCardFromSources).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Fire Dragon" }),
      "Fire Dragon",
    );
  });

  it("returns 400 for a whitespace-only name on accept", async () => {
    const res = await app.request("/api/admin/v1/cards/new/Fire%20Dragon/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardFields: { id: "fire-dragon", name: "   ", types: ["unit"], domains: ["fury"] },
      }),
    });
    expect(res.status).toBe(400);
    expect(mockTrxMut.acceptNewCardFromSources).not.toHaveBeenCalled();
  });

  it("returns 400 for a punctuation-only name on accept", async () => {
    const res = await app.request("/api/admin/v1/cards/new/Fire%20Dragon/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardFields: { id: "fire-dragon", name: "...", types: ["unit"], domains: ["fury"] },
      }),
    });
    expect(res.status).toBe(400);
    expect(mockTrxMut.acceptNewCardFromSources).not.toHaveBeenCalled();
  });
});

describe("POST /cards/new/:name/accept-favorites", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 200 with accept result and records the card and each printing", async () => {
    const result = { cardSlug: "fire-dragon", printingsCreated: 1, skipped: [] };
    const created = [{ printingId: "p-1", imageIds: [] }];
    mockAcceptFavoriteNewCard.mockImplementation(async (_t, _r, _n, _p, sink) => {
      sink.push(...created);
      return {
        ...result,
        accepted: [
          {
            printing: { printingId: "p-1", imageIds: [] },
            fields: { shortCode: "OGN-001" } as never,
            candidatePrintingIds: [CP_ID],
          },
        ],
        checkedCandidateCardIds: [],
      };
    });

    const res = await app.request("/api/admin/v1/cards/new/Fire%20Dragon/accept-favorites", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual(result);
    expect(mockAdminEvents.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ action: "card.accept-favorites", cardSlug: "fire-dragon" }),
      expect.objectContaining({
        action: "printing.accept",
        entityType: "printing",
        entityId: "p-1",
        cardSlug: "fire-dragon",
      }),
    ]);
    expect(mockAcceptFavoriteNewCard).toHaveBeenCalledWith(
      mockTransact,
      expect.objectContaining({ candidateCards: mockCandidateCards, catalogMutations: mockMut }),
      "Fire Dragon",
      expect.any(Set),
      created,
    );
    expect(mockFinishPrintingAccepts).toHaveBeenCalledWith(expect.anything(), mockIo, created, {
      catalogChanged: true,
    });
  });

  it("refuses a name the batch would hold back and creates nothing", async () => {
    vi.mocked(assertFavoriteNewCardEligible).mockRejectedValue(
      badRequest("Not accepted: a similar card exists: Fire Drake"),
    );

    const res = await app.request("/api/admin/v1/cards/new/Fire%20Dragon/accept-favorites", {
      method: "POST",
    });
    expect(res.status).toBe(400);
    expect(mockAcceptFavoriteNewCard).not.toHaveBeenCalled();
  });

  it("finishes the printings it created even when the accept then fails", async () => {
    const created = [{ printingId: "p-1", imageIds: ["img-1"] }];
    mockAcceptFavoriteNewCard.mockImplementation(async (_t, _r, _n, _p, sink) => {
      sink.push(...created);
      throw new Error("connection reset");
    });

    const res = await app.request("/api/admin/v1/cards/new/Fire%20Dragon/accept-favorites", {
      method: "POST",
    });
    expect(res.status).toBe(500);
    expect(mockFinishPrintingAccepts).toHaveBeenCalledWith(expect.anything(), mockIo, created, {
      catalogChanged: true,
    });
  });

  it("refreshes the catalog views for a card created without printings", async () => {
    mockAcceptFavoriteNewCard.mockResolvedValue({
      cardSlug: "fire-dragon",
      printingsCreated: 0,
      skipped: [],
      accepted: [],
      checkedCandidateCardIds: [],
    });

    const res = await app.request("/api/admin/v1/cards/new/Fire%20Dragon/accept-favorites", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    expect(mockFinishPrintingAccepts).toHaveBeenCalledWith(expect.anything(), mockIo, [], {
      catalogChanged: true,
    });
  });
});

describe("POST /cards/new/:name/link", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockTransact.mockImplementation(async (cb) => cb(trxRepos()));
  });

  it("returns 204 on successful link", async () => {
    mockMut.getCardById.mockResolvedValue({
      id: "a0000000-0000-4000-a000-0000000000d1",
      name: "Fire Dragon",
      slug: "fire-dragon",
    });
    mockTrxMut.createNameAliases.mockResolvedValue(undefined);

    const res = await app.request("/api/admin/v1/cards/new/Fire%20Dragon/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: "a0000000-0000-4000-a000-0000000000d1" }),
    });
    expect(res.status).toBe(204);
    expect(mockTrxMut.createNameAliases).toHaveBeenCalledWith(
      "Fire Dragon",
      "a0000000-0000-4000-a000-0000000000d1",
    );
  });

  it("relinks the name's unlinked candidate printings inside the alias transaction", async () => {
    mockMut.getCardById.mockResolvedValue({
      id: "a0000000-0000-4000-a000-0000000000d1",
      name: "Fire Dragon",
      slug: "fd",
    });
    const repos = trxRepos();
    mockTransact.mockImplementation(async (cb) => cb(repos));

    await app.request("/api/admin/v1/cards/new/firedragon/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: "a0000000-0000-4000-a000-0000000000d1" }),
    });

    expect(mockRelinkCandidatePrintings).toHaveBeenCalledWith(repos, { normName: "firedragon" });
    expect(mockTrxMut.createNameAliases.mock.invocationCallOrder[0]).toBeLessThan(
      mockRelinkCandidatePrintings.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("scopes the relink to the normalized form of a raw name", async () => {
    mockMut.getCardById.mockResolvedValue({
      id: "a0000000-0000-4000-a000-0000000000d1",
      name: "Fire Dragon",
      slug: "fd",
    });
    const repos = trxRepos();
    mockTransact.mockImplementation(async (cb) => cb(repos));

    await app.request("/api/admin/v1/cards/new/Fire%20Dragon/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: "a0000000-0000-4000-a000-0000000000d1" }),
    });

    expect(mockRelinkCandidatePrintings).toHaveBeenCalledWith(repos, { normName: "firedragon" });
  });

  it.each(["", "fire-dragon"])("returns 400 when cardId is %j", async (cardId) => {
    const res = await app.request("/api/admin/v1/cards/new/Fire%20Dragon/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId }),
    });
    expect(res.status).toBe(400);
    expect(mockMut.getCardById).not.toHaveBeenCalled();
  });

  it("returns 404 when target card not found", async () => {
    mockMut.getCardById.mockResolvedValue(null);

    const res = await app.request("/api/admin/v1/cards/new/Fire%20Dragon/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: "a0000000-0000-4000-a000-0000000000d2" }),
    });
    expect(res.status).toBe(404);
    const json = await readJson(res);
    expect(json.message).toContain("Target card not found");
  });
});

describe("POST /cards/:cardId/accept-printing", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockTransact.mockImplementation(async (cb) => cb(trxRepos()));
  });

  it("returns 200 with printingId and finishes the accept", async () => {
    const created = { printingId: "printing-uuid", imageIds: [] };
    mockCreateNewPrintings.mockResolvedValue([created]);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/accept-printing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        printingFields: {
          shortCode: "FD",
          rarity: "common",
          artist: "Alice",
          publicCode: "OGS-001",
        },
        candidatePrintingIds: [
          "a0000000-0000-4000-a000-0000000000c1",
          "a0000000-0000-4000-a000-0000000000c2",
        ],
      }),
    });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual({ printingId: "printing-uuid" });
    expect(mockCreateNewPrintings).toHaveBeenCalledWith(expect.anything(), CARD_ID2, [
      {
        printingFields: expect.objectContaining({ shortCode: "FD" }),
        candidatePrintingIds: [
          "a0000000-0000-4000-a000-0000000000c1",
          "a0000000-0000-4000-a000-0000000000c2",
        ],
        secondFaceId: null,
      },
    ]);
    expect(mockFinishPrintingAccepts).toHaveBeenCalledWith(expect.anything(), mockIo, [created]);
  });

  it("rejects a printing without a rarity", async () => {
    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/accept-printing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        printingFields: { shortCode: "FD", artist: "Alice", publicCode: "OGS-001" },
        candidatePrintingIds: ["a0000000-0000-4000-a000-0000000000c1"],
      }),
    });
    expect(res.status).toBe(400);
    expect(mockCreateNewPrintings).not.toHaveBeenCalled();
  });
});

describe("POST /cards/:cardId/accept-printings", () => {
  const fields = (shortCode: string) => ({
    shortCode,
    rarity: "common",
    artist: "Alice",
    publicCode: `${shortCode}/298`,
  });
  const post = (groups: object[]) =>
    app.request(`/api/admin/v1/cards/${CARD_ID2}/accept-printings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groups }),
    });

  beforeEach(() => {
    vi.resetAllMocks();
    mockTransact.mockImplementation(async (cb) => cb(trxRepos()));
  });

  it("creates every group together, finishes once and records one event per printing", async () => {
    const created = [
      { printingId: "p-1", imageIds: [] },
      { printingId: "p-2", imageIds: [] },
    ];
    mockCreateNewPrintings.mockResolvedValue(created);
    mockMut.getCardById.mockResolvedValue({ id: CARD_ID2, slug: "fire-dragon" });

    const res = await post([
      { printingFields: fields("OGN-001"), candidatePrintingIds: [CP_ID] },
      {
        printingFields: fields("OGN-002"),
        candidatePrintingIds: [PRINTING_ID],
        secondSideFaceId: CARD_ID,
      },
    ]);

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ printingIds: ["p-1", "p-2"] });
    expect(mockCreateNewPrintings).toHaveBeenCalledOnce();
    expect(mockCreateNewPrintings.mock.calls[0]?.[2]).toEqual([
      expect.objectContaining({ candidatePrintingIds: [CP_ID], secondFaceId: null }),
      expect.objectContaining({ candidatePrintingIds: [PRINTING_ID], secondFaceId: CARD_ID }),
    ]);
    expect(mockFinishPrintingAccepts).toHaveBeenCalledOnce();
    expect(mockFinishPrintingAccepts).toHaveBeenCalledWith(expect.anything(), mockIo, created);
    expect(mockAdminEvents.insertMany).toHaveBeenCalledOnce();
    expect(mockAdminEvents.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        action: "printing.accept",
        entityId: "p-1",
        entityLabel: "OGN-001",
        cardSlug: "fire-dragon",
      }),
      expect.objectContaining({ action: "printing.accept", entityId: "p-2" }),
    ]);
  });

  it("finishes nothing when the batch fails", async () => {
    mockCreateNewPrintings.mockRejectedValue(badRequest("Invalid printing fields"));

    const res = await post([{ printingFields: fields("OGN-001"), candidatePrintingIds: [CP_ID] }]);

    expect(res.status).toBe(400);
    expect(mockFinishPrintingAccepts).not.toHaveBeenCalled();
  });

  it("rejects an empty batch", async () => {
    const res = await post([]);
    expect(res.status).toBe(400);
    expect(mockCreateNewPrintings).not.toHaveBeenCalled();
  });
});

describe("POST /cards/candidate-printings/relink", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns the relink result", async () => {
    mockRelinkCandidatePrintings.mockResolvedValue({ examined: 10, linked: 4 });

    const res = await app.request("/api/admin/v1/cards/candidate-printings/relink", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ examined: 10, linked: 4 });
  });
});

describe("POST /cards/candidates/check-matching", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    scheduler = mockScheduler;
  });

  it("starts the check matching job and records who started it", async () => {
    mockScheduler.runNow.mockResolvedValue({ runId: "run-1", status: "running" });

    const res = await app.request("/api/admin/v1/cards/candidates/check-matching", {
      method: "POST",
    });

    expect(res.status).toBe(202);
    expect(await readJson(res)).toEqual({ runId: "run-1", status: "running" });
    expect(mockScheduler.runNow).toHaveBeenCalledWith("candidates.check_matching");
    expect(mockAdminEvents.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: USER_ID,
        action: "candidate-card.check-matching",
        newValues: { runId: "run-1" },
      }),
    );
  });

  it("returns the run already in progress without recording another start", async () => {
    mockScheduler.runNow.mockResolvedValue({ runId: "run-1", status: "already_running" });

    const res = await app.request("/api/admin/v1/cards/candidates/check-matching", {
      method: "POST",
    });

    expect(res.status).toBe(202);
    expect(await readJson(res)).toEqual({ runId: "run-1", status: "already_running" });
    expect(mockAdminEvents.insert).not.toHaveBeenCalled();
  });

  it("returns 503 when the app runs without a scheduler", async () => {
    scheduler = undefined;

    const res = await app.request("/api/admin/v1/cards/candidates/check-matching", {
      method: "POST",
    });

    expect(res.status).toBe(503);
  });
});

describe("POST /cards/:cardSlug/accept-favorite-printings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 200 with the accept result", async () => {
    const skipped = [{ shortCode: "OGN-202", reason: "exists" }];
    const created = [
      { printingId: "p-1", imageIds: [] },
      { printingId: "p-2", imageIds: ["img-1"] },
    ];
    mockAcceptFavoritePrintingsForCard.mockImplementation(async (_t, _r, _s, _p, sink) => {
      sink.push(...created);
      return {
        printingsCreated: 2,
        skipped,
        createdPrintingIds: ["p-1", "p-2"],
        checkedCandidateCardIds: [],
      };
    });

    const res = await app.request("/api/admin/v1/cards/fire-dragon/accept-favorite-printings", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual({ printingsCreated: 2, skipped });
    expect(mockAcceptFavoritePrintingsForCard).toHaveBeenCalledWith(
      mockTransact,
      expect.objectContaining({ catalogMutations: mockMut }),
      "fire-dragon",
      expect.any(Set),
      created,
    );
    expect(mockFinishPrintingAccepts).toHaveBeenCalledWith(expect.anything(), mockIo, created);
  });

  it("finishes the printings it created even when the accept then fails", async () => {
    const created = [{ printingId: "p-1", imageIds: [] }];
    mockAcceptFavoritePrintingsForCard.mockImplementation(async (_t, _r, _s, _p, sink) => {
      sink.push(...created);
      throw new Error("connection reset");
    });

    const res = await app.request("/api/admin/v1/cards/fire-dragon/accept-favorite-printings", {
      method: "POST",
    });
    expect(res.status).toBe(500);
    expect(mockFinishPrintingAccepts).toHaveBeenCalledWith(expect.anything(), mockIo, created);
  });
});

describe("POST /cards/create", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockTransact.mockImplementation(async (cb) => cb(trxRepos()));
  });

  it("creates a card and returns its slug", async () => {
    mockTrxMut.acceptNewCardFromSources.mockResolvedValue(undefined);

    const res = await app.request("/api/admin/v1/cards/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "fire-dragon",
        name: "Fire Dragon",
        types: ["unit"],
        domains: ["fury"],
      }),
    });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual({ cardSlug: "fire-dragon" });
    expect(mockTrxMut.acceptNewCardFromSources).toHaveBeenCalledWith(
      expect.objectContaining({ id: "fire-dragon" }),
      expect.any(String),
    );
  });

  it("answers a taken slug with a 409 instead of a 500", async () => {
    mockTrxMut.acceptNewCardFromSources.mockRejectedValue(
      Object.assign(new Error("duplicate key"), {
        code: "23505",
        constraint_name: "uq_cards_slug",
      }),
    );

    const res = await app.request("/api/admin/v1/cards/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "fire-dragon",
        name: "Fire Dragon",
        types: ["unit"],
        domains: ["fury"],
      }),
    });
    expect(res.status).toBe(409);
    expect(await readJson(res)).toMatchObject({ message: "A card with this slug already exists" });
  });

  it("stores the trimmed name", async () => {
    mockTrxMut.acceptNewCardFromSources.mockResolvedValue(undefined);

    const res = await app.request("/api/admin/v1/cards/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "fire-dragon",
        name: " Fire Dragon  ",
        types: ["unit"],
        domains: ["fury"],
      }),
    });
    expect(res.status).toBe(200);
    expect(mockTrxMut.acceptNewCardFromSources).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Fire Dragon" }),
      "firedragon",
    );
  });

  it("rejects a name made only of punctuation", async () => {
    const res = await app.request("/api/admin/v1/cards/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "fire-dragon", name: "—", types: ["unit"], domains: ["fury"] }),
    });
    expect(res.status).toBe(400);
    expect(mockTrxMut.acceptNewCardFromSources).not.toHaveBeenCalled();
  });

  it("rejects a body missing required card fields", async () => {
    const res = await app.request("/api/admin/v1/cards/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "fire-dragon" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /cards/:cardId/printings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockTransact.mockImplementation(async (cb) => cb(trxRepos()));
  });

  it("creates a printing, returns its id and finishes the accept", async () => {
    const created = { printingId: "printing-uuid", imageIds: [] };
    mockCreateNewPrinting.mockResolvedValue(created);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/printings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shortCode: "FD",
        setId: "origin",
        rarity: "common",
        artist: "Alice",
        publicCode: "OGS-001",
      }),
    });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual({ printingId: "printing-uuid" });
    expect(mockCreateNewPrinting).toHaveBeenCalledWith(
      expect.anything(),
      CARD_ID2,
      expect.objectContaining({ shortCode: "FD", setId: "origin" }),
      [],
    );
    expect(mockFinishPrintingAccepts).toHaveBeenCalledWith(expect.anything(), mockIo, [created]);
  });
});

describe("POST /cards/upload", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 200 with the ingest summary (candidates transformed before the service)", async () => {
    const result = {
      provider: "test-provider",
      newCards: 5,
      removedCards: 0,
      updates: 2,
      unchanged: 3,
      newPrintings: 10,
      removedPrintings: 0,
      printingUpdates: 1,
      printingsUnchanged: 9,
      errors: [],
      newCardDetails: [{ name: "New Card", shortCode: "NC" }],
      removedCardDetails: [],
      updatedCards: [],
      newPrintingDetails: [],
      removedPrintingDetails: [],
      updatedPrintings: [],
    };
    mockIngestCandidates.mockResolvedValue(result);

    const res = await app.request("/api/admin/v1/cards/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "test-provider",
        candidates: [
          {
            card: { name: "New Card", external_id: "ext-1" },
            printings: [{ short_code: "NC-001", external_id: "p-ext-1" }],
          },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.provider).toBe("test-provider");
    expect(json.newCards).toBe(5);
    // The `{ card, printings }` wrapper is flattened by the input transform into
    // the `IngestCard` shape the service expects.
    expect(mockIngestCandidates).toHaveBeenCalledWith(mockTransact, "test-provider", [
      expect.objectContaining({
        name: "New Card",
        external_id: "ext-1",
        printings: expect.any(Array),
      }),
    ]);
  });
});

describe("audit events", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockTransact.mockImplementation(async (cb) => cb(trxRepos()));
  });

  it("accept-field on a card records old and new value", async () => {
    mockMut.getFullCardById.mockResolvedValue({
      id: CARD_ID2,
      name: "Flame Drake",
      slug: "flame-drake",
      energy: 2,
    });
    mockMut.updateCardById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "energy", value: 4 }),
    });
    expect(res.status).toBe(200);
    expect(mockAdminEvents.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: USER_ID,
        action: "card.accept-field",
        entityType: "card",
        entityId: CARD_ID2,
        entityLabel: "Flame Drake",
        cardSlug: "flame-drake",
        oldValues: { energy: 2 },
        newValues: { energy: 4 },
      }),
    );
  });

  it("accept-field on a printing records the prior value from printingBefore", async () => {
    mockMut.getFullPrintingById.mockResolvedValue({
      id: PRINTING_ID,
      cardId: CARD_ID2,
      shortCode: "OGN-001",
      artist: "Old Artist",
    });
    mockMut.updatePrintingFieldById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "artist", value: "New Artist" }),
    });
    expect(res.status).toBe(200);
    expect(mockAdminEvents.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "printing.accept-field",
        entityType: "printing",
        entityId: PRINTING_ID,
        entityLabel: "OGN-001",
        oldValues: { artist: "Old Artist" },
        newValues: { artist: "New Artist" },
      }),
    );
  });

  it("accept-field on a card that stores the value already held writes nothing and no audit event", async () => {
    mockMut.getFullCardById.mockResolvedValue({
      id: CARD_ID2,
      name: "Flame Drake",
      slug: "flame-drake",
      comment: null,
    });

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID2}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "comment", value: "   " }),
    });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ written: false });
    expect(mockMut.updateCardById).not.toHaveBeenCalled();
    expect(mockAdminEvents.insert).not.toHaveBeenCalled();
  });

  it("accept-field on a printing that stores the value already held writes nothing and no audit event", async () => {
    mockMut.getFullPrintingById.mockResolvedValue({
      id: PRINTING_ID,
      cardId: CARD_ID2,
      shortCode: "OGN-001",
      flavorText: null,
    });

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "flavorText", value: "  " }),
    });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ written: false });
    expect(mockMut.updatePrintingFieldById).not.toHaveBeenCalled();
    expect(mockAdminEvents.insert).not.toHaveBeenCalled();
  });

  it("accept-field on a printing with a null value still clears distribution channels", async () => {
    mockMut.getFullPrintingById.mockResolvedValue({
      id: PRINTING_ID,
      cardId: CARD_ID2,
      shortCode: "OGN-001",
    });
    mockDistributionChannels.listForPrintingIds.mockResolvedValue([{ channelSlug: "launch" }]);

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/accept-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "distributionChannelSlugs", value: null }),
    });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ written: true });
    expect(vi.mocked(updatePrintingDistributionChannels)).toHaveBeenCalledWith(
      expect.anything(),
      PRINTING_ID,
      [],
    );
    expect(mockAdminEvents.insert).toHaveBeenCalled();
  });

  it("deleting a candidate printing records the deleted key fields", async () => {
    mockCandidateCards.getCandidatePrintingById.mockResolvedValue({
      id: CP_ID,
      shortCode: "OGN-002",
      setId: "ogn",
      rarity: "rare",
      finish: "foil",
      artVariant: "normal",
      externalId: "ext-2",
    });
    mockCandidateCards.deleteCandidatePrinting.mockResolvedValue(true);

    const res = await app.request(`/api/admin/v1/cards/candidate-printings/${CP_ID}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
    expect(mockAdminEvents.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "candidate-printing.delete",
        entityId: CP_ID,
        entityLabel: "OGN-002",
        oldValues: expect.objectContaining({ shortCode: "OGN-002", finish: "foil" }),
      }),
    );
  });

  it("renaming a card records the slug transition", async () => {
    mockMut.getCardById.mockResolvedValue({ id: CARD_ID, name: "Fireball", slug: "old-slug" });
    mockMut.renameCardSlugById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newId: "new-slug" }),
    });
    expect(res.status).toBe(204);
    expect(mockAdminEvents.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "card.rename",
        oldValues: { slug: "old-slug" },
        newValues: { slug: "new-slug" },
        cardSlug: "new-slug",
      }),
    );
  });

  it("check/uncheck bookkeeping writes NO audit event", async () => {
    mockCandidateCards.checkCandidatePrinting.mockResolvedValue({ numUpdatedRows: 1n });

    const res = await app.request(`/api/admin/v1/cards/candidate-printings/${CP_ID}/check`, {
      method: "POST",
    });
    expect(res.status).toBe(204);
    expect(mockAdminEvents.insert).not.toHaveBeenCalled();
  });

  it("a failing audit insert does not fail the mutation", async () => {
    mockMut.getCardById.mockResolvedValue({ id: CARD_ID, name: "Fireball", slug: "old-slug" });
    mockMut.renameCardSlugById.mockResolvedValue(undefined);
    mockAdminEvents.insert.mockRejectedValue(new Error("audit table on fire"));

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newId: "new-slug" }),
    });
    expect(res.status).toBe(204);
  });
});
