import { emptyBoardDocument } from "@openrift/shared/board-state";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../../errors.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { adminBoardStatesRouter } from "./admin-board-states";

const mockBoardStatesRepo = {
  listAllWithOwner: vi.fn(),
  getById: vi.fn(),
  setFeatured: vi.fn(),
};

const ADMIN_ID = "a0000000-0001-4000-a000-000000000001";
const BOARD_ID = "b0000000-0001-4000-a000-000000000001";

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: ADMIN_ID } as never);
  c.set("repos", { boardStates: mockBoardStatesRepo } as never);
  await next();
});
registerRouterForTest(app, adminBoardStatesRouter);
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.message, code: err.code }, err.status as 400);
  }
  throw err;
});

const now = new Date("2026-09-15T00:00:00Z");

function dbRow(overrides: object = {}) {
  return {
    id: BOARD_ID,
    userId: "u1",
    title: "Stunned defender",
    answer: null,
    coreRulesVersion: "2026-07-16",
    tournamentRulesVersion: null,
    document: emptyBoardDocument(),
    isPublic: true,
    shareToken: "AbCdEfGhIjKl",
    isFeatured: false,
    createdAt: now,
    updatedAt: now,
    ownerName: "Teemo",
    ...overrides,
  };
}

function setFeatured(featured: boolean) {
  return app.request(`/api/admin/v1/board-states/${BOARD_ID}/featured`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ featured }),
  });
}

describe("admin board states", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("lists every board state with its owner", async () => {
    mockBoardStatesRepo.listAllWithOwner.mockResolvedValue([dbRow()]);

    const res = await app.request("/api/admin/v1/board-states");

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({
      items: [
        {
          id: BOARD_ID,
          title: "Stunned defender",
          ownerName: "Teemo",
          coreRulesVersion: "2026-07-16",
          tournamentRulesVersion: null,
          stepCount: 1,
          shareToken: "AbCdEfGhIjKl",
          isFeatured: false,
          updatedAt: "2026-09-15T00:00:00.000Z",
        },
      ],
    });
  });

  it("features a shared board state", async () => {
    mockBoardStatesRepo.getById.mockResolvedValue(dbRow());
    mockBoardStatesRepo.setFeatured.mockResolvedValue(dbRow({ isFeatured: true }));

    const res = await setFeatured(true);

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.isFeatured).toBe(true);
    expect(mockBoardStatesRepo.setFeatured).toHaveBeenCalledWith(BOARD_ID, true);
  });

  it("rejects featuring an unshared board state", async () => {
    mockBoardStatesRepo.getById.mockResolvedValue(dbRow({ isPublic: false, shareToken: null }));

    const res = await setFeatured(true);

    expect(res.status).toBe(400);
    expect(mockBoardStatesRepo.setFeatured).not.toHaveBeenCalled();
  });

  it("rejects featuring a board state with a token but sharing turned off", async () => {
    mockBoardStatesRepo.getById.mockResolvedValue(dbRow({ isPublic: false }));

    const res = await setFeatured(true);

    expect(res.status).toBe(400);
  });

  it("unfeatures a board state that is no longer shared", async () => {
    mockBoardStatesRepo.getById.mockResolvedValue(dbRow({ isPublic: false, isFeatured: true }));
    mockBoardStatesRepo.setFeatured.mockResolvedValue(dbRow({ isPublic: false }));

    const res = await setFeatured(false);

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.shareToken).toBeNull();
  });

  it("returns 404 for an unknown board state", async () => {
    mockBoardStatesRepo.getById.mockResolvedValue(undefined);

    const res = await setFeatured(true);

    expect(res.status).toBe(404);
  });
});
