import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { customTagsRouter } from "./public-custom-tags";

const AT = new Date("2026-03-17T00:00:00.000Z");

const mockCustomTagsRepo = {
  listAll: vi.fn(),
  assignmentsByCard: vi.fn(),
};

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  // oxlint-disable-next-line no-explicit-any -- test mock doesn't match full Repos type
  c.set("repos", { customTags: mockCustomTagsRepo } as any);
  await next();
});
registerRouterForTest(app, customTagsRouter);

describe("GET /api/v1/custom-tags", () => {
  beforeEach(() => {
    mockCustomTagsRepo.listAll.mockReset();
    mockCustomTagsRepo.assignmentsByCard.mockReset();
    mockCustomTagsRepo.listAll.mockResolvedValue([]);
    mockCustomTagsRepo.assignmentsByCard.mockResolvedValue(new Map());
  });

  it("returns the tag definitions without admin fields", async () => {
    mockCustomTagsRepo.listAll.mockResolvedValue([
      {
        id: "t-1",
        slug: "bandle-city",
        label: "Bandle City",
        category: "region",
        categoryLabel: "Region",
        categoryId: "c-1",
        description: null,
        sortOrder: 0,
        createdAt: AT,
        updatedAt: AT,
      },
    ]);
    const res = await app.request("/api/v1/custom-tags");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.tags).toEqual([
      {
        id: "t-1",
        slug: "bandle-city",
        label: "Bandle City",
        category: "region",
        categoryLabel: "Region",
        description: null,
        sortOrder: 0,
      },
    ]);
  });

  it("returns the assignments as a card-keyed map", async () => {
    mockCustomTagsRepo.assignmentsByCard.mockResolvedValue(
      new Map([
        ["card-1", ["bandle-city", "bilgewater"]],
        ["card-2", ["demacia"]],
      ]),
    );
    const res = await app.request("/api/v1/custom-tags");
    const json = await readJson(res);
    expect(json.assignments).toEqual({
      "card-1": ["bandle-city", "bilgewater"],
      "card-2": ["demacia"],
    });
  });

  it("returns empty collections when no tags exist", async () => {
    const res = await app.request("/api/v1/custom-tags");
    const json = await readJson(res);
    expect(json).toEqual({ tags: [], assignments: {} });
  });
});
