import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { adminCardBansRouter } from "./admin-cards-bans";

const CARD_ID = "019cfc3b-0389-744b-837c-792fd586300e";

const mockCardBans = {
  listCircuits: vi.fn(),
  setBanListCircuits: vi.fn(),
  listByCard: vi.fn(),
  getActiveBan: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  unban: vi.fn(),
  deleteUndatedCircuitRows: vi.fn(),
};

const mockCatalogMutations = { getCardById: vi.fn() };
const mockAdminEvents = { insert: vi.fn() };

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("repos", {
    cardBans: mockCardBans,
    catalogMutations: mockCatalogMutations,
    adminEvents: mockAdminEvents,
  } as never);
  c.set("user", { id: "a0000000-0001-4000-a000-000000000001" } as never);
  await next();
});
registerRouterForTest(app, adminCardBansRouter);

const banRow = {
  id: "019d6a00-1234-7000-8000-000000000001",
  cardId: CARD_ID,
  formatId: "standard",
  formatName: "Standard",
  circuit: null,
  bannedAt: "2026-01-15",
  reason: "Power level concerns",
  createdAt: new Date("2026-01-15T12:00:00.000Z"),
};

const banResponse = { ...banRow, createdAt: "2026-01-15T12:00:00.000Z" };

describe("GET /api/admin/v1/cards/:id/bans", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCardBans.setBanListCircuits.mockResolvedValue([]);
  });

  it("returns the active bans with an ISO createdAt", async () => {
    mockCardBans.listByCard.mockResolvedValue([banRow]);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/bans`);
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual({ bans: [banResponse] });
    expect(mockCardBans.listByCard).toHaveBeenCalledWith(CARD_ID);
  });

  it("returns an empty list when the card has no bans", async () => {
    mockCardBans.listByCard.mockResolvedValue([]);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/bans`);
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual({ bans: [] });
  });
});

describe("POST /api/admin/v1/cards/:id/bans", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCardBans.setBanListCircuits.mockResolvedValue([]);
  });

  it("creates a ban and returns 201", async () => {
    mockCatalogMutations.getCardById.mockResolvedValue({
      id: CARD_ID,
      name: "Fireball",
      slug: "fireball",
    });
    mockCardBans.getActiveBan.mockResolvedValue(null);
    mockCardBans.create.mockResolvedValue(banRow);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/bans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formatId: "standard",
        bannedAt: "2026-01-15",
        reason: "Power level concerns",
      }),
    });

    expect(res.status).toBe(201);
    const json = await readJson(res);
    expect(json).toEqual({ ban: banResponse });
    expect(mockCardBans.create).toHaveBeenCalledWith({
      cardId: CARD_ID,
      formatId: "standard",
      circuit: null,
      bannedAt: "2026-01-15",
      reason: "Power level concerns",
    });
  });

  it("creates an undated ban for a circuit", async () => {
    mockCatalogMutations.getCardById.mockResolvedValue({
      id: CARD_ID,
      name: "Fireball",
      slug: "fireball",
    });
    mockCardBans.listCircuits.mockResolvedValue([
      { slug: "korea", label: "Korea", countryCodes: ["KR"] },
    ]);
    mockCardBans.getActiveBan.mockResolvedValue(null);
    mockCardBans.create.mockResolvedValue({ ...banRow, circuit: "korea", bannedAt: null });

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/bans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formatId: "standard", circuit: "korea", bannedAt: null }),
    });

    expect(res.status).toBe(201);
    expect(mockCardBans.getActiveBan).toHaveBeenCalledWith(CARD_ID, "standard", "korea");
    expect(mockCardBans.create).toHaveBeenCalledWith(
      expect.objectContaining({ circuit: "korea", bannedAt: null }),
    );
  });

  it("adds a pending row in each per-set circuit that has no active ban", async () => {
    mockCatalogMutations.getCardById.mockResolvedValue({
      id: CARD_ID,
      name: "Fireball",
      slug: "fireball",
    });
    mockCardBans.setBanListCircuits.mockResolvedValue(["korea", "traditional-chinese"]);
    mockCardBans.getActiveBan.mockImplementation((_cardId, _formatId, circuit) =>
      Promise.resolve(circuit === "traditional-chinese" ? banRow : undefined),
    );
    mockCardBans.create.mockResolvedValue(banRow);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/bans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formatId: "standard", bannedAt: "2026-01-15" }),
    });

    expect(res.status).toBe(201);
    const written = mockCardBans.create.mock.calls.map(([ban]) => [
      ban.formatId,
      ban.circuit,
      ban.bannedAt,
    ]);
    expect(written).toEqual([
      ["standard", "korea", null],
      ["2v2", "korea", null],
      ["2v2", null, "2026-01-15"],
      ["standard", null, "2026-01-15"],
    ]);
  });

  it("adds no 2v2 ban for a ban in another format", async () => {
    mockCatalogMutations.getCardById.mockResolvedValue({
      id: CARD_ID,
      name: "Fireball",
      slug: "fireball",
    });
    mockCardBans.getActiveBan.mockResolvedValue(undefined);
    mockCardBans.create.mockResolvedValue({ ...banRow, formatId: "2v2" });

    await app.request(`/api/admin/v1/cards/${CARD_ID}/bans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formatId: "2v2", bannedAt: "2026-01-15" }),
    });

    expect(mockCardBans.create).toHaveBeenCalledTimes(1);
  });

  it("adds no pending rows for a circuit ban", async () => {
    mockCatalogMutations.getCardById.mockResolvedValue({
      id: CARD_ID,
      name: "Fireball",
      slug: "fireball",
    });
    mockCardBans.listCircuits.mockResolvedValue([
      { slug: "korea", label: "Korea", countryCodes: ["KR"] },
    ]);
    mockCardBans.setBanListCircuits.mockResolvedValue(["korea"]);
    mockCardBans.getActiveBan.mockResolvedValue(undefined);
    mockCardBans.create.mockResolvedValue({ ...banRow, circuit: "korea" });

    await app.request(`/api/admin/v1/cards/${CARD_ID}/bans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formatId: "standard", circuit: "korea", bannedAt: "2026-12-01" }),
    });

    expect(mockCardBans.setBanListCircuits).not.toHaveBeenCalled();
    expect(mockCardBans.create).toHaveBeenCalledTimes(1);
  });

  it("rejects an unknown circuit before writing", async () => {
    mockCatalogMutations.getCardById.mockResolvedValue({
      id: CARD_ID,
      name: "Fireball",
      slug: "fireball",
    });
    mockCardBans.listCircuits.mockResolvedValue([]);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/bans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formatId: "standard", circuit: "atlantis", bannedAt: null }),
    });

    expect(res.status).toBe(400);
    expect(mockCardBans.create).not.toHaveBeenCalled();
  });

  it("rejects an undated global ban", async () => {
    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/bans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formatId: "standard", bannedAt: null }),
    });

    expect(res.status).toBe(400);
    expect(mockCardBans.create).not.toHaveBeenCalled();
  });

  it("defaults a missing reason to null", async () => {
    mockCatalogMutations.getCardById.mockResolvedValue({
      id: CARD_ID,
      name: "Fireball",
      slug: "fireball",
    });
    mockCardBans.getActiveBan.mockResolvedValue(null);
    mockCardBans.create.mockResolvedValue({ ...banRow, reason: null });

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/bans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formatId: "standard", bannedAt: "2026-01-15" }),
    });

    expect(res.status).toBe(201);
    expect(mockCardBans.create).toHaveBeenCalledWith(expect.objectContaining({ reason: null }));
  });

  it("404s when the card does not exist", async () => {
    mockCatalogMutations.getCardById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/bans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formatId: "standard", bannedAt: "2026-01-15" }),
    });

    expect(res.status).toBe(404);
    expect(mockCardBans.create).not.toHaveBeenCalled();
  });

  it("409s when the card is already banned in the format", async () => {
    mockCatalogMutations.getCardById.mockResolvedValue({
      id: CARD_ID,
      name: "Fireball",
      slug: "fireball",
    });
    mockCardBans.getActiveBan.mockResolvedValue(banRow);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/bans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formatId: "standard", bannedAt: "2026-01-15" }),
    });

    expect(res.status).toBe(409);
    const json = await readJson(res);
    expect(json.message).toContain("already banned");
    expect(mockCardBans.create).not.toHaveBeenCalled();
  });

  it("409s when a concurrent ban wins the race past the pre-check", async () => {
    mockCatalogMutations.getCardById.mockResolvedValue({
      id: CARD_ID,
      name: "Fireball",
      slug: "fireball",
    });
    mockCardBans.getActiveBan.mockResolvedValue(undefined);
    mockCardBans.create.mockRejectedValue(
      Object.assign(new Error("duplicate key"), {
        code: "23505",
        constraint_name: "uq_card_bans_active",
      }),
    );

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/bans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formatId: "standard", bannedAt: "2026-01-15" }),
    });

    expect(res.status).toBe(409);
    const body = await readJson(res);
    expect(body.message).toBe("Card is already banned in standard");
  });
});

describe("PATCH /api/admin/v1/cards/:id/bans", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCardBans.setBanListCircuits.mockResolvedValue([]);
  });

  it("updates the ban and returns it", async () => {
    mockCardBans.update.mockResolvedValue({ ...banRow, reason: "Updated" });

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/bans`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formatId: "standard", reason: "Updated" }),
    });

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.ban.reason).toBe("Updated");
    expect(mockCardBans.update).toHaveBeenCalledWith(CARD_ID, "standard", null, {
      reason: "Updated",
    });
  });

  it("passes only the provided fields through to the repo", async () => {
    mockCardBans.update.mockResolvedValue(banRow);

    await app.request(`/api/admin/v1/cards/${CARD_ID}/bans`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formatId: "standard", bannedAt: "2026-02-01" }),
    });

    expect(mockCardBans.update).toHaveBeenCalledWith(CARD_ID, "standard", null, {
      bannedAt: "2026-02-01",
    });
  });

  it("404s when there is no active ban for the format", async () => {
    mockCardBans.update.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/bans`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formatId: "standard", reason: "x" }),
    });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/admin/v1/cards/:id/bans", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCardBans.setBanListCircuits.mockResolvedValue([]);
  });

  it("removes the ban and returns 204", async () => {
    mockCardBans.unban.mockResolvedValue("lifted");

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/bans`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formatId: "standard" }),
    });

    expect(res.status).toBe(204);
    expect(mockCardBans.unban).toHaveBeenCalledWith(CARD_ID, "standard", null);
  });

  it("404s when no active ban matched the format", async () => {
    mockCardBans.unban.mockResolvedValue(null);

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/bans`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formatId: "standard" }),
    });

    expect(res.status).toBe(404);
    const json = await readJson(res);
    expect(json.message).toContain("No active ban found");
    expect(mockCardBans.unban).toHaveBeenCalledWith(CARD_ID, "standard", null);
  });
});

describe("DELETE of a ban that never took effect", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("also drops the pending circuit rows the global ban created", async () => {
    mockCardBans.unban.mockResolvedValue("deleted");

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/bans`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formatId: "standard" }),
    });

    expect(res.status).toBe(204);
    expect(mockCardBans.deleteUndatedCircuitRows).toHaveBeenCalledWith(CARD_ID, "standard");
  });

  it("leaves circuit rows alone when a lifted ban is removed", async () => {
    mockCardBans.unban.mockResolvedValue("lifted");

    await app.request(`/api/admin/v1/cards/${CARD_ID}/bans`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formatId: "standard" }),
    });

    expect(mockCardBans.deleteUndatedCircuitRows).not.toHaveBeenCalled();
  });
});

describe("audit events", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCardBans.setBanListCircuits.mockResolvedValue([]);
  });

  it("ban create records an event with the card label", async () => {
    mockCardBans.getActiveBan.mockResolvedValue(null);
    mockCardBans.create.mockResolvedValue(banRow);
    mockCatalogMutations.getCardById.mockResolvedValue({
      id: CARD_ID,
      name: "Fireball",
      slug: "fireball",
    });

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/bans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formatId: "standard", bannedAt: "2026-01-15" }),
    });
    expect(res.status).toBe(201);
    expect(mockAdminEvents.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ban.add",
        entityType: "ban",
        entityLabel: "Fireball",
        cardSlug: "fireball",
        newValues: expect.objectContaining({ formatId: "standard" }),
      }),
    );
  });

  it("ban removal records the prior ban as oldValues", async () => {
    mockCardBans.getActiveBan.mockResolvedValue(banRow);
    mockCardBans.unban.mockResolvedValue("lifted");

    const res = await app.request(`/api/admin/v1/cards/${CARD_ID}/bans`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formatId: "standard" }),
    });
    expect(res.status).toBe(204);
    expect(mockAdminEvents.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ban.delete",
        oldValues: expect.objectContaining({ formatId: "standard" }),
      }),
    );
  });
});
