import { emptyBoardDocument } from "@openrift/shared/board-state";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../../errors.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { publicBoardStatesRouter } from "./public-board-states";

const mockRepo = { findByShareToken: vi.fn(), listFeatured: vi.fn() };

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("repos", { boardStates: mockRepo } as never);
  await next();
});
registerRouterForTest(app, publicBoardStatesRouter);
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.message, code: err.code }, err.status as 400);
  }
  throw err;
});

beforeEach(() => vi.resetAllMocks());

const now = new Date("2026-09-15T00:00:00Z");

function row(overrides: object = {}) {
  return {
    id: "board-1",
    userId: "user-1",
    title: "Stunned defender",
    answer: null,
    coreRulesVersion: "2026-07-16",
    tournamentRulesVersion: null,
    document: emptyBoardDocument(),
    isPublic: true,
    shareToken: "AbC123XyZ789",
    isFeatured: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("GET /api/v1/board-states/share/{token}", () => {
  it("resolves a shared board state without a session", async () => {
    mockRepo.findByShareToken.mockResolvedValue({ boardState: row(), ownerName: "Rell" });

    const res = await app.request("/api/v1/board-states/share/AbC123XyZ789");

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.boardState.title).toBe("Stunned defender");
    expect(json.boardState).not.toHaveProperty("shareToken");
    expect(json.owner.displayName).toBe("Rell");
  });

  it("falls back to Anonymous for an owner without a name", async () => {
    mockRepo.findByShareToken.mockResolvedValue({ boardState: row(), ownerName: null });

    const json = await readJson(await app.request("/api/v1/board-states/share/AbC123XyZ789"));

    expect(json.owner.displayName).toBe("Anonymous");
  });

  it("404s for an unknown or revoked token", async () => {
    mockRepo.findByShareToken.mockResolvedValue(undefined);

    const res = await app.request("/api/v1/board-states/share/nope");

    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/featured-board-states", () => {
  it("lists featured board states with their share tokens", async () => {
    mockRepo.listFeatured.mockResolvedValue([
      row({ isFeatured: true }),
      row({ id: "board-2", shareToken: null }),
    ]);

    const res = await app.request("/api/v1/featured-board-states");

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.items).toHaveLength(1);
    expect(json.items[0]).toMatchObject({ id: "board-1", shareToken: "AbC123XyZ789" });
  });
});
