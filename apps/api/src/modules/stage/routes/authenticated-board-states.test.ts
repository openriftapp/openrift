import { emptyBoardDocument } from "@openrift/shared/board-state";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../../errors.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { boardStatesRouter } from "./authenticated-board-states";

const mockBoardStatesRepo = {
  listForUser: vi.fn(() => Promise.resolve([] as object[])),
  getByIdForUser: vi.fn(() => Promise.resolve(undefined as object | undefined)),
  create: vi.fn((_userId: string, values: object) => Promise.resolve(dbRow(values))),
  update: vi.fn(() => Promise.resolve(undefined as object | undefined)),
  remove: vi.fn(() => Promise.resolve(false)),
  getShareState: vi.fn(() =>
    Promise.resolve(undefined as { shareToken: string | null; isPublic: boolean } | undefined),
  ),
  setShare: vi.fn(() =>
    Promise.resolve(undefined as { shareToken: string | null; isPublic: boolean } | undefined),
  ),
};

const mockRulesRepo = {
  listVersions: vi.fn(() => Promise.resolve([{ kind: "core", version: "2026-07-16" }])),
};

const USER_ID = "a0000000-0001-4000-a000-000000000001";
const BOARD_ID = "b0000000-0001-4000-a000-000000000001";

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: USER_ID } as never);
  c.set("repos", { boardStates: mockBoardStatesRepo, rules: mockRulesRepo } as never);
  await next();
});
registerRouterForTest(app, boardStatesRouter);
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
    userId: USER_ID,
    title: "Stunned defender",
    answer: null,
    coreRulesVersion: "2026-07-16",
    tournamentRulesVersion: null,
    document: emptyBoardDocument(),
    isPublic: false,
    shareToken: null,
    isFeatured: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function request(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await app.request(`/api/v1${path}`, { ...init, headers });
  return { status: res.status, body: res.status === 204 ? null : await readJson(res) };
}

function createBody(overrides: object = {}) {
  return JSON.stringify({
    title: "Stunned defender",
    coreRulesVersion: "2026-07-16",
    tournamentRulesVersion: null,
    document: emptyBoardDocument(),
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /board-states", () => {
  it("returns the caller's board states", async () => {
    mockBoardStatesRepo.listForUser.mockResolvedValue([dbRow()]);

    const { status, body } = await request("/board-states");

    expect(status).toBe(200);
    expect(mockBoardStatesRepo.listForUser).toHaveBeenCalledWith(USER_ID);
    expect(body).toMatchObject({ items: [{ id: BOARD_ID, title: "Stunned defender" }] });
  });
});

describe("GET /board-states/{id}", () => {
  it("404s for a board state the caller does not own", async () => {
    const { status } = await request(`/board-states/${BOARD_ID}`);
    expect(status).toBe(404);
    expect(mockBoardStatesRepo.getByIdForUser).toHaveBeenCalledWith(BOARD_ID, USER_ID);
  });
});

describe("POST /board-states", () => {
  it("creates a board state and stores an empty answer as null", async () => {
    const { status, body } = await request("/board-states", {
      method: "POST",
      body: createBody({ answer: "   " }),
    });

    expect(status).toBe(201);
    expect(mockBoardStatesRepo.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ answer: null, coreRulesVersion: "2026-07-16" }),
    );
    expect(body).toMatchObject({ id: BOARD_ID });
  });

  it("rejects an unknown rules version", async () => {
    const { status } = await request("/board-states", {
      method: "POST",
      body: createBody({ coreRulesVersion: "1999-01-01" }),
    });

    expect(status).toBe(400);
    expect(mockBoardStatesRepo.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown tournament rules version", async () => {
    const { status } = await request("/board-states", {
      method: "POST",
      body: createBody({ tournamentRulesVersion: "1999-01-01" }),
    });

    expect(status).toBe(400);
    expect(mockRulesRepo.listVersions).toHaveBeenCalledWith("tournament");
    expect(mockBoardStatesRepo.create).not.toHaveBeenCalled();
  });

  it("accepts a board state pinned to both rules versions", async () => {
    mockRulesRepo.listVersions.mockImplementation((kind?: string) =>
      Promise.resolve([{ kind: kind ?? "core", version: "2026-07-16" }]),
    );

    const { status } = await request("/board-states", {
      method: "POST",
      body: createBody({ tournamentRulesVersion: "2026-07-16" }),
    });

    expect(status).toBe(201);
    expect(mockBoardStatesRepo.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        coreRulesVersion: "2026-07-16",
        tournamentRulesVersion: "2026-07-16",
      }),
    );
  });

  it("rejects a board state without any rules pin", async () => {
    const { status } = await request("/board-states", {
      method: "POST",
      body: createBody({ coreRulesVersion: null }),
    });

    expect(status).toBe(400);
    expect(mockBoardStatesRepo.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid board document", async () => {
    const { status } = await request("/board-states", {
      method: "POST",
      body: createBody({ document: { ...emptyBoardDocument(), playerCount: 5 } }),
    });

    expect(status).toBe(400);
    expect(mockBoardStatesRepo.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /board-states/{id}", () => {
  it("404s before touching the row when the caller does not own it", async () => {
    const { status } = await request(`/board-states/${BOARD_ID}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "New" }),
    });

    expect(status).toBe(404);
    expect(mockBoardStatesRepo.update).not.toHaveBeenCalled();
  });

  it("updates only the fields that were sent", async () => {
    mockBoardStatesRepo.getByIdForUser.mockResolvedValue(dbRow());
    mockBoardStatesRepo.update.mockResolvedValue(dbRow({ title: "New" }));

    const { status, body } = await request(`/board-states/${BOARD_ID}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "New" }),
    });

    expect(status).toBe(200);
    expect(mockBoardStatesRepo.update).toHaveBeenCalledWith(BOARD_ID, USER_ID, { title: "New" });
    expect(mockRulesRepo.listVersions).not.toHaveBeenCalled();
    expect(body).toMatchObject({ title: "New" });
  });

  it("validates a changed rules version against the stored kind", async () => {
    mockBoardStatesRepo.getByIdForUser.mockResolvedValue(dbRow());

    const { status } = await request(`/board-states/${BOARD_ID}`, {
      method: "PATCH",
      body: JSON.stringify({ coreRulesVersion: "1999-01-01" }),
    });

    expect(status).toBe(400);
    expect(mockRulesRepo.listVersions).toHaveBeenCalledWith("core");
    expect(mockBoardStatesRepo.update).not.toHaveBeenCalled();
  });

  it("rejects clearing the only rules pin", async () => {
    mockBoardStatesRepo.getByIdForUser.mockResolvedValue(dbRow());

    const { status } = await request(`/board-states/${BOARD_ID}`, {
      method: "PATCH",
      body: JSON.stringify({ coreRulesVersion: null }),
    });

    expect(status).toBe(400);
    expect(mockBoardStatesRepo.update).not.toHaveBeenCalled();
  });

  it("returns the current row for an empty patch", async () => {
    mockBoardStatesRepo.getByIdForUser.mockResolvedValue(dbRow());

    const { status } = await request(`/board-states/${BOARD_ID}`, {
      method: "PATCH",
      body: JSON.stringify({}),
    });

    expect(status).toBe(200);
    expect(mockBoardStatesRepo.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /board-states/{id}", () => {
  it("404s when nothing was deleted", async () => {
    const { status } = await request(`/board-states/${BOARD_ID}`, { method: "DELETE" });
    expect(status).toBe(404);
  });

  it("204s when the row was deleted", async () => {
    mockBoardStatesRepo.remove.mockResolvedValue(true);
    const { status } = await request(`/board-states/${BOARD_ID}`, { method: "DELETE" });
    expect(status).toBe(204);
  });
});

describe("POST /board-states/{id}/share", () => {
  it("returns the existing token when already shared", async () => {
    mockBoardStatesRepo.getShareState.mockResolvedValue({ shareToken: "tok", isPublic: true });

    const { status, body } = await request(`/board-states/${BOARD_ID}/share`, { method: "POST" });

    expect(status).toBe(200);
    expect(body).toEqual({ shareToken: "tok", isPublic: true });
    expect(mockBoardStatesRepo.setShare).not.toHaveBeenCalled();
  });

  it("mints a token for an unshared board state", async () => {
    mockBoardStatesRepo.getShareState.mockResolvedValue({ shareToken: null, isPublic: false });
    mockBoardStatesRepo.setShare.mockResolvedValue({ shareToken: "new", isPublic: true });

    const { status, body } = await request(`/board-states/${BOARD_ID}/share`, { method: "POST" });

    expect(status).toBe(200);
    expect(body).toMatchObject({ isPublic: true, shareToken: expect.any(String) });
  });
});
