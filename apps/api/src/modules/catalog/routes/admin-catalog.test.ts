import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { adminCatalogRouter } from "./admin-catalog";

const mockSetsRepo = {
  listAll: vi.fn(),
  cardCountsBySet: vi.fn(),
  printingCountsBySet: vi.fn(),
  releasesBySet: vi.fn(),
  replaceReleases: vi.fn(),
  putRelease: vi.fn(),
  deleteRelease: vi.fn(),
  getRef: vi.fn(),
  update: vi.fn(),
  createIfNotExists: vi.fn(),
};

// AppErrors are bridged to ORPCErrors, so the error body is `{ message, code }`.
const USER_ID = "a0000000-0001-4000-a000-000000000001";

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: USER_ID } as never);
  c.set("repos", { sets: mockSetsRepo } as never);
  await next();
});
registerRouterForTest(app, adminCatalogRouter);

// setType is a real sets column; release periods come from the set_releases join.
// Fixtures carry both since the output schema requires them.

const setId1 = "a0000000-0001-4000-a000-000000000010";
const setId2 = "a0000000-0001-4000-a000-000000000020";

const dbSet1 = {
  id: setId1,
  slug: "origin-set",
  name: "Origin Set",
  printedTotal: 100,
  sortOrder: 0,
  setType: "main" as const,
};

const dbSet2 = {
  id: setId2,
  slug: "second-set",
  name: "Second Set",
  printedTotal: null,
  sortOrder: 1,
  setType: "supplemental" as const,
};

describe("GET /api/admin/v1/sets", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 200 with sets including card and printing counts", async () => {
    mockSetsRepo.listAll.mockResolvedValue([dbSet1, dbSet2]);
    mockSetsRepo.cardCountsBySet.mockResolvedValue([{ setId: setId1, cardCount: 50 }]);
    mockSetsRepo.printingCountsBySet.mockResolvedValue([
      { setId: setId1, printingCount: 75 },
      { setId: setId2, printingCount: 10 },
    ]);
    mockSetsRepo.releasesBySet.mockResolvedValue(
      new Map([[setId1, { EN: { releasedAt: "2026-01-01", precision: "day" } }]]),
    );

    const res = await app.request("/api/admin/v1/sets");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.sets).toHaveLength(2);
    expect(json.sets[0]).toEqual({
      id: setId1,
      slug: "origin-set",
      name: "Origin Set",
      printedTotal: 100,
      sortOrder: 0,
      releases: { EN: { releasedAt: "2026-01-01", precision: "day" } },
      setType: "main",
      cardCount: 50,
      printingCount: 75,
    });
    expect(json.sets[1]).toEqual({
      id: setId2,
      slug: "second-set",
      name: "Second Set",
      printedTotal: null,
      sortOrder: 1,
      // No rows in `set_releases`: not announced in any language.
      releases: {},
      setType: "supplemental",
      cardCount: 0,
      printingCount: 10,
    });
  });

  it("defaults cardCount and printingCount to 0 when not in maps", async () => {
    mockSetsRepo.listAll.mockResolvedValue([dbSet2]);
    mockSetsRepo.cardCountsBySet.mockResolvedValue([]);
    mockSetsRepo.printingCountsBySet.mockResolvedValue([]);
    mockSetsRepo.releasesBySet.mockResolvedValue(new Map());

    const res = await app.request("/api/admin/v1/sets");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.sets[0].cardCount).toBe(0);
    expect(json.sets[0].printingCount).toBe(0);
  });
});

describe("PATCH /api/admin/v1/sets/:id", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 204 on successful update", async () => {
    mockSetsRepo.update.mockResolvedValue(true);
    const res = await app.request(`/api/admin/v1/sets/${setId1}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Updated Name",
        printedTotal: 200,
        releases: { EN: { releasedAt: "2026-06-01", precision: "day" } },
        setType: "main",
      }),
    });
    expect(res.status).toBe(204);
    expect(mockSetsRepo.update).toHaveBeenCalledWith(setId1, {
      name: "Updated Name",
      printedTotal: 200,
      setType: "main",
    });
    expect(mockSetsRepo.replaceReleases).toHaveBeenCalledWith(setId1, {
      EN: { releasedAt: "2026-06-01", precision: "day" },
    });
  });

  it("accepts a coarse release period and an undated language", async () => {
    mockSetsRepo.update.mockResolvedValue(true);
    const res = await app.request(`/api/admin/v1/sets/${setId1}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Updated Name",
        printedTotal: 200,
        releases: {
          FR: { releasedAt: "2026-04-01", precision: "quarter" },
          KR: { releasedAt: null, precision: null },
        },
        setType: "main",
      }),
    });
    expect(res.status).toBe(204);
    expect(mockSetsRepo.replaceReleases).toHaveBeenCalledWith(setId1, {
      FR: { releasedAt: "2026-04-01", precision: "quarter" },
      KR: { releasedAt: null, precision: null },
    });
  });

  it("rejects a coarse period whose date is not the period start", async () => {
    const res = await app.request(`/api/admin/v1/sets/${setId1}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Updated Name",
        printedTotal: 200,
        releases: { FR: { releasedAt: "2026-05-17", precision: "quarter" } },
        setType: "main",
      }),
    });
    expect(res.status).toBe(400);
    expect(mockSetsRepo.replaceReleases).not.toHaveBeenCalled();
  });

  it("rejects a date without a precision", async () => {
    const res = await app.request(`/api/admin/v1/sets/${setId1}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Updated Name",
        printedTotal: 200,
        releases: { FR: { releasedAt: "2026-05-17", precision: null } },
        setType: "main",
      }),
    });
    expect(res.status).toBe(400);
    expect(mockSetsRepo.replaceReleases).not.toHaveBeenCalled();
  });

  it("clears every release row when the map is empty", async () => {
    mockSetsRepo.update.mockResolvedValue(true);
    const res = await app.request(`/api/admin/v1/sets/${setId1}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test",
        printedTotal: 50,
        releases: {},
        setType: "supplemental",
      }),
    });
    expect(res.status).toBe(204);
    expect(mockSetsRepo.update).toHaveBeenCalledWith(setId1, {
      name: "Test",
      printedTotal: 50,
      setType: "supplemental",
    });
    expect(mockSetsRepo.replaceReleases).toHaveBeenCalledWith(setId1, {});
  });
});

describe("PATCH /api/admin/v1/sets/:id without releases", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("leaves the release rows alone", async () => {
    mockSetsRepo.update.mockResolvedValue(true);
    const res = await app.request(`/api/admin/v1/sets/${setId1}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Name", printedTotal: 200, setType: "main" }),
    });
    expect(res.status).toBe(204);
    expect(mockSetsRepo.replaceReleases).not.toHaveBeenCalled();
  });
});

describe("PUT /api/admin/v1/sets/:id/releases/:language", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("writes only that language's row", async () => {
    mockSetsRepo.getRef.mockResolvedValue({ slug: "origin-set", name: "Origin Set" });
    const res = await app.request(`/api/admin/v1/sets/${setId1}/releases/FR`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ release: { releasedAt: "2026-04-01", precision: "quarter" } }),
    });
    expect(res.status).toBe(204);
    expect(mockSetsRepo.putRelease).toHaveBeenCalledWith(setId1, "FR", {
      releasedAt: "2026-04-01",
      precision: "quarter",
    });
    expect(mockSetsRepo.replaceReleases).not.toHaveBeenCalled();
  });

  it("rejects a coarse period whose date is not the period start", async () => {
    const res = await app.request(`/api/admin/v1/sets/${setId1}/releases/FR`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ release: { releasedAt: "2026-04-15", precision: "month" } }),
    });
    expect(res.status).toBe(400);
    expect(mockSetsRepo.putRelease).not.toHaveBeenCalled();
  });

  it("returns 404 when the set does not exist", async () => {
    mockSetsRepo.getRef.mockResolvedValue(undefined);
    const res = await app.request(`/api/admin/v1/sets/${setId1}/releases/FR`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ release: { releasedAt: null, precision: null } }),
    });
    expect(res.status).toBe(404);
    expect(mockSetsRepo.putRelease).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/v1/sets/:id/releases/:language", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("removes only that language's row", async () => {
    const res = await app.request(`/api/admin/v1/sets/${setId1}/releases/FR`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
    expect(mockSetsRepo.deleteRelease).toHaveBeenCalledWith(setId1, "FR");
  });
});

describe("POST /api/admin/v1/sets", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 201 with created set id", async () => {
    mockSetsRepo.createIfNotExists.mockResolvedValue(setId1);
    const res = await app.request("/api/admin/v1/sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "new-set",
        name: "New Set",
        printedTotal: 50,
        releases: { EN: { releasedAt: "2026-03-01", precision: "day" } },
        setType: "main",
      }),
    });
    expect(res.status).toBe(201);
    const json = await readJson(res);
    expect(json.id).toBe(setId1);
    expect(mockSetsRepo.createIfNotExists).toHaveBeenCalledWith({
      slug: "new-set",
      name: "New Set",
      printedTotal: 50,
      setType: "main",
    });
    expect(mockSetsRepo.replaceReleases).toHaveBeenCalledWith(setId1, {
      EN: { releasedAt: "2026-03-01", precision: "day" },
    });
  });

  it("creates a supplemental set as supplemental", async () => {
    mockSetsRepo.createIfNotExists.mockResolvedValue(setId1);
    const res = await app.request("/api/admin/v1/sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "new-set",
        name: "New Set",
        printedTotal: 50,
        setType: "supplemental",
      }),
    });
    expect(res.status).toBe(201);
    expect(mockSetsRepo.createIfNotExists).toHaveBeenCalledWith({
      slug: "new-set",
      name: "New Set",
      printedTotal: 50,
      setType: "supplemental",
    });
  });

  it("returns 409 when set already exists", async () => {
    mockSetsRepo.createIfNotExists.mockResolvedValue(null);
    const res = await app.request("/api/admin/v1/sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "existing-set",
        name: "Existing Set",
        printedTotal: 100,
        setType: "main",
      }),
    });
    expect(res.status).toBe(409);
    const json = await readJson(res);
    expect(json.message).toContain("already exists");
  });

  it("creates a set with no releases", async () => {
    mockSetsRepo.createIfNotExists.mockResolvedValue(setId1);
    const res = await app.request("/api/admin/v1/sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "new-set", name: "New Set", printedTotal: 50, setType: "main" }),
    });
    expect(res.status).toBe(201);
    expect(mockSetsRepo.replaceReleases).not.toHaveBeenCalled();
  });
});

describe("PUT /api/admin/v1/sets/reorder", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 400 when ids count does not match existing sets", async () => {
    mockSetsRepo.listAll.mockResolvedValue([dbSet1, dbSet2]);
    const res = await app.request("/api/admin/v1/sets/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [setId1] }),
    });
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.message).toContain("Expected 2");
  });
});
