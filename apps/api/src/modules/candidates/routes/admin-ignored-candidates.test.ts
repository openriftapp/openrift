import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { adminIgnoredCandidatesRouter } from "./admin-ignored-candidates";

const mockRepo = {
  listIgnoredCards: vi.fn(),
  listIgnoredPrintings: vi.fn(),
  ignoreCards: vi.fn(),
  unignoreCards: vi.fn(),
  ignorePrinting: vi.fn(),
  unignorePrinting: vi.fn(),
};

const mockCandidateCards = {
  listPrintingLinkOverrides: vi.fn(async (): Promise<unknown[]> => []),
  deletePrintingLinkOverride: vi.fn(),
};

const mockAdminEvents = { insert: vi.fn(), insertMany: vi.fn() };

// Returning null is the scraped-provider case: no ledger row, so the
// outcome service no-ops.
const mockCardSubmissions = {
  getByExternalId: vi.fn().mockResolvedValue(null),
  resolve: vi.fn(),
  reopen: vi.fn(),
};

const USER_ID = "a0000000-0001-4000-a000-000000000001";

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: USER_ID } as never);
  c.set("repos", {
    ignoredCandidates: mockRepo,
    candidateCards: mockCandidateCards,
    adminEvents: mockAdminEvents,
    cardSubmissions: mockCardSubmissions,
  } as never);
  await next();
});
registerRouterForTest(app, adminIgnoredCandidatesRouter);

const now = new Date("2026-03-17T00:00:00Z");

const dbIgnoredCard = {
  id: "a0000000-0001-4000-a000-000000000010",
  provider: "tcgplayer",
  externalId: "12345",
  createdAt: now,
};

const dbIgnoredCard2 = {
  id: "a0000000-0001-4000-a000-000000000011",
  provider: "cardmarket",
  externalId: "67890",
  createdAt: now,
};

const dbIgnoredPrinting = {
  id: "a0000000-0001-4000-a000-000000000020",
  provider: "tcgplayer",
  externalId: "54321",
  finish: "foil",
  createdAt: now,
};

const dbIgnoredPrintingNullFinish = {
  id: "a0000000-0001-4000-a000-000000000021",
  provider: "cardmarket",
  externalId: "99999",
  finish: null,
  createdAt: now,
};

const dbPrintingLink = {
  provider: "playloltcg",
  externalId: "VEN·R06b:foil",
  finish: "foil",
  printingId: "a0000000-0001-4000-a000-000000000030",
  shortCode: "VEN-R06b",
  cardSlug: "vengeful-spirit",
  cardName: "Vengeful Spirit",
  createdAt: now,
};

describe("GET /api/admin/v1/ignored-candidates", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 200 with cards and printings", async () => {
    mockRepo.listIgnoredCards.mockResolvedValue([dbIgnoredCard, dbIgnoredCard2]);
    mockRepo.listIgnoredPrintings.mockResolvedValue([
      dbIgnoredPrinting,
      dbIgnoredPrintingNullFinish,
    ]);
    const res = await app.request("/api/admin/v1/ignored-candidates");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.cards).toHaveLength(2);
    expect(json.cards[0]).toEqual({
      id: dbIgnoredCard.id,
      provider: "tcgplayer",
      externalId: "12345",
      createdAt: now.toISOString(),
    });
    expect(json.cards[1]).toEqual({
      id: dbIgnoredCard2.id,
      provider: "cardmarket",
      externalId: "67890",
      createdAt: now.toISOString(),
    });
    expect(json.printings).toHaveLength(2);
    expect(json.printings[0]).toEqual({
      id: dbIgnoredPrinting.id,
      provider: "tcgplayer",
      externalId: "54321",
      finish: "foil",
      createdAt: now.toISOString(),
    });
    expect(json.printings[1]).toEqual({
      id: dbIgnoredPrintingNullFinish.id,
      provider: "cardmarket",
      externalId: "99999",
      finish: null,
      createdAt: now.toISOString(),
    });
  });

  it("returns empty arrays when nothing is ignored", async () => {
    mockRepo.listIgnoredCards.mockResolvedValue([]);
    mockRepo.listIgnoredPrintings.mockResolvedValue([]);
    mockCandidateCards.listPrintingLinkOverrides.mockResolvedValue([]);
    const res = await app.request("/api/admin/v1/ignored-candidates");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.cards).toEqual([]);
    expect(json.printings).toEqual([]);
    expect(json.printingLinks).toEqual([]);
  });

  it("returns the pinned printing links with their card", async () => {
    mockRepo.listIgnoredCards.mockResolvedValue([]);
    mockRepo.listIgnoredPrintings.mockResolvedValue([]);
    mockCandidateCards.listPrintingLinkOverrides.mockResolvedValue([dbPrintingLink]);
    const res = await app.request("/api/admin/v1/ignored-candidates");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.printingLinks).toEqual([{ ...dbPrintingLink, createdAt: now.toISOString() }]);
  });
});

describe("DELETE /api/admin/v1/ignored-candidates/printing-links", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 204 and drops the override", async () => {
    mockCandidateCards.deletePrintingLinkOverride.mockResolvedValue(undefined);
    const res = await app.request("/api/admin/v1/ignored-candidates/printing-links", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "test-provider", externalId: "OGN-197b", finish: "" }),
    });
    expect(res.status).toBe(204);
    expect(mockCandidateCards.deletePrintingLinkOverride).toHaveBeenCalledWith({
      provider: "test-provider",
      externalId: "OGN-197b",
      finish: "",
    });
  });
});

describe("POST /api/admin/v1/ignored-candidates/cards", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 204 when card is ignored", async () => {
    mockRepo.ignoreCards.mockResolvedValue(undefined);
    const res = await app.request("/api/admin/v1/ignored-candidates/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sources: [{ provider: "tcgplayer", externalId: "12345" }] }),
    });
    expect(res.status).toBe(204);
    expect(mockRepo.ignoreCards).toHaveBeenCalledWith([
      { provider: "tcgplayer", externalId: "12345" },
    ]);
  });

  it("rejects the user submission behind an ignored candidate", async () => {
    mockRepo.ignoreCards.mockResolvedValue(undefined);
    mockCardSubmissions.getByExternalId.mockResolvedValue({ id: "sub-1", status: "pending" });
    const res = await app.request("/api/admin/v1/ignored-candidates/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sources: [{ provider: "usersubmission", externalId: "jinx--20260813-1200--u1" }],
      }),
    });
    expect(res.status).toBe(204);
    expect(mockCardSubmissions.resolve).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({ status: "rejected", resolvedByUserId: USER_ID }),
    );
  });

  it("ignores a list of sources in one write and drops repeats", async () => {
    const res = await app.request("/api/admin/v1/ignored-candidates/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sources: [
          { provider: "tcgplayer", externalId: "1" },
          { provider: "cardmarket", externalId: "2" },
          { provider: "tcgplayer", externalId: "1" },
        ],
      }),
    });
    expect(res.status).toBe(204);
    expect(mockRepo.ignoreCards).toHaveBeenCalledOnce();
    expect(mockRepo.ignoreCards).toHaveBeenCalledWith([
      { provider: "tcgplayer", externalId: "1" },
      { provider: "cardmarket", externalId: "2" },
    ]);
  });

  it("rejects an empty source list", async () => {
    const res = await app.request("/api/admin/v1/ignored-candidates/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sources: [] }),
    });
    expect(res.status).toBe(400);
    expect(mockRepo.ignoreCards).not.toHaveBeenCalled();
  });

  it("leaves a scraped provider's candidate alone", async () => {
    mockRepo.ignoreCards.mockResolvedValue(undefined);
    mockCardSubmissions.getByExternalId.mockResolvedValue(null);
    const res = await app.request("/api/admin/v1/ignored-candidates/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sources: [{ provider: "tcgplayer", externalId: "12345" }] }),
    });
    expect(res.status).toBe(204);
    expect(mockCardSubmissions.resolve).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/v1/ignored-candidates/cards", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 204 when card is unignored", async () => {
    mockRepo.unignoreCards.mockResolvedValue(undefined);
    const res = await app.request("/api/admin/v1/ignored-candidates/cards", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sources: [{ provider: "tcgplayer", externalId: "12345" }] }),
    });
    expect(res.status).toBe(204);
    expect(mockRepo.unignoreCards).toHaveBeenCalledWith([
      { provider: "tcgplayer", externalId: "12345" },
    ]);
  });

  it("returns a rejected submission to the queue when unignored", async () => {
    mockRepo.unignoreCards.mockResolvedValue(undefined);
    mockCardSubmissions.getByExternalId.mockResolvedValue({ id: "sub-1", status: "rejected" });
    const res = await app.request("/api/admin/v1/ignored-candidates/cards", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sources: [{ provider: "usersubmission", externalId: "jinx--20260813-1200--u1" }],
      }),
    });
    expect(res.status).toBe(204);
    expect(mockCardSubmissions.reopen).toHaveBeenCalledWith("sub-1");
  });
});

describe("POST /api/admin/v1/ignored-candidates/printings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each([
    { name: "with finish", body: { finish: "foil" }, finish: "foil" },
    { name: "with null finish", body: { finish: null }, finish: null },
    { name: "with finish omitted", body: {}, finish: null },
  ])("returns 204 when printing is ignored $name", async ({ body, finish }) => {
    mockRepo.ignorePrinting.mockResolvedValue(undefined);
    const res = await app.request("/api/admin/v1/ignored-candidates/printings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "tcgplayer", externalId: "54321", ...body }),
    });
    expect(res.status).toBe(204);
    expect(mockRepo.ignorePrinting).toHaveBeenCalledWith({
      provider: "tcgplayer",
      externalId: "54321",
      finish,
    });
  });
});

describe("DELETE /api/admin/v1/ignored-candidates/printings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each([
    { name: "with finish", finish: "foil" },
    { name: "with null finish", finish: null },
  ])("returns 204 when printing is unignored $name", async ({ finish }) => {
    mockRepo.unignorePrinting.mockResolvedValue(undefined);
    const res = await app.request("/api/admin/v1/ignored-candidates/printings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "tcgplayer", externalId: "54321", finish }),
    });
    expect(res.status).toBe(204);
    expect(mockRepo.unignorePrinting).toHaveBeenCalledWith("tcgplayer", "54321", finish);
  });
});

describe("audit events", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("ignoring cards records one composite-id event per source in one write", async () => {
    mockRepo.ignoreCards.mockResolvedValue(undefined);

    const res = await app.request("/api/admin/v1/ignored-candidates/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sources: [
          { provider: "gallery", externalId: "ext-1" },
          { provider: "gallery", externalId: "ext-2" },
        ],
      }),
    });
    expect(res.status).toBe(204);
    expect(mockAdminEvents.insertMany).toHaveBeenCalledOnce();
    expect(mockAdminEvents.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        action: "candidate-card.ignore",
        entityType: "candidate-card",
        entityId: "gallery:ext-1",
        newValues: { provider: "gallery", externalId: "ext-1" },
      }),
      expect.objectContaining({ entityId: "gallery:ext-2" }),
    ]);
  });
});
