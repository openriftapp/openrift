import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { adminFormatSetsRouter } from "./admin-format-sets";

const SET_ID = "019cfc3b-0389-744b-837c-792fd586300e";

const mockFormatSets = { listAll: vi.fn(), upsert: vi.fn(), remove: vi.fn() };
const mockAdminEvents = { insert: vi.fn() };

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("repos", { formatSets: mockFormatSets, adminEvents: mockAdminEvents } as never);
  c.set("user", { id: "a0000000-0001-4000-a000-000000000001" } as never);
  await next();
});
registerRouterForTest(app, adminFormatSetsRouter);

const windowRow = {
  id: "w1",
  formatId: "standard",
  setId: SET_ID,
  setSlug: "LGC",
  circuit: null,
  legalFrom: "2027-01-29",
  legalUntil: null,
};

describe("adminFormatSetsRouter", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("lists the windows", async () => {
    mockFormatSets.listAll.mockResolvedValue([windowRow]);

    const res = await app.request("/api/admin/v1/format-sets");
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ formatSets: [windowRow] });
  });

  it("upserts a window and records it", async () => {
    mockFormatSets.upsert.mockResolvedValue(windowRow);
    const body = {
      formatId: "standard",
      setId: SET_ID,
      circuit: null,
      legalFrom: "2027-01-29",
      legalUntil: null,
    };

    const res = await app.request("/api/admin/v1/format-sets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(200);
    expect(mockFormatSets.upsert).toHaveBeenCalledWith(body);
    expect(mockAdminEvents.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "format-set.upsert", entityLabel: "LGC" }),
    );
  });

  it("rejects an end date that is not after the start date", async () => {
    const res = await app.request("/api/admin/v1/format-sets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formatId: "standard",
        setId: SET_ID,
        circuit: null,
        legalFrom: "2027-01-29",
        legalUntil: "2027-01-29",
      }),
    });

    expect(res.status).toBe(400);
    expect(mockFormatSets.upsert).not.toHaveBeenCalled();
  });

  it("404s when removing a window that does not exist", async () => {
    mockFormatSets.remove.mockResolvedValue(false);

    const res = await app.request("/api/admin/v1/format-sets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formatId: "standard", setId: SET_ID, circuit: "korea" }),
    });

    expect(res.status).toBe(404);
    expect(mockAdminEvents.insert).not.toHaveBeenCalled();
  });
});
