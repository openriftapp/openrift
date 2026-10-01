import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { errataRouter } from "./public-errata";

const ANNOUNCEMENT = {
  id: "019f2a10-5c1e-7d4f-9a62-1b3c4d5e6f70",
  name: "Vendetta Errata Updates",
  publishedOn: "2026-07-23",
  url: "https://example.invalid/vendetta",
};

const ENTRY_ROW = {
  announcementId: ANNOUNCEMENT.id,
  correctedRulesText: "Draw 2.",
  correctedEffectText: null,
  source: null,
  sourceUrl: null,
  effectiveDate: null,
  slug: "astral-heron",
  name: "Astral Heron",
  tags: [],
  types: ["Unit"],
  domains: ["Calm"],
  shortCode: "VEN-044",
  printedRulesText: "Draw 1.",
  printedEffectText: null,
  setSlug: "VEN",
  setName: "Vendetta",
  setSortOrder: 6,
  imageId: null,
};

const mockCardErrataRepo = {
  announcements: vi.fn(() => Promise.resolve([ANNOUNCEMENT])),
  listEntries: vi.fn(() => Promise.resolve([ENTRY_ROW])),
};

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  // oxlint-disable-next-line no-explicit-any -- test mock doesn't match full Repos type
  c.set("repos", { cardErrata: mockCardErrataRepo } as any);
  await next();
});
registerRouterForTest(app, errataRouter);

describe("GET /api/v1/errata", () => {
  it("returns the announcements, sets and entries", async () => {
    const res = await app.request("/api/v1/errata");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.announcements).toEqual([ANNOUNCEMENT]);
    expect(json.sets).toEqual([{ slug: "VEN", name: "Vendetta" }]);
    expect(json.entries).toHaveLength(1);
    expect(json.entries[0].card.slug).toBe("astral-heron");
  });
});
