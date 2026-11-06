import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../../errors.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { deckFoldersRouter } from "./authenticated-deck-folders";

const USER_ID = "a0000000-0001-4000-a000-000000000001";
const FOLDER_ID = "a0000000-0001-4000-a000-0000000000f1";
const DECK_A = "a0000000-0001-4000-a000-000000000010";
const DECK_B = "a0000000-0001-4000-a000-000000000011";

const now = new Date("2026-11-06T00:00:00Z");

const folderRow = {
  id: FOLDER_ID,
  userId: USER_ID,
  name: "Summoner Skirmish",
  sortOrder: 0,
  deckCount: 2,
  createdAt: now,
  updatedAt: now,
};

const mockFolders = {
  listForUser: vi.fn(() => Promise.resolve([] as object[])),
  addDecks: vi.fn(() => Promise.resolve()),
  removeDecks: vi.fn(() => Promise.resolve()),
};

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: USER_ID } as never);
  c.set("repos", { deckFolders: mockFolders } as never);
  await next();
});
registerRouterForTest(app, deckFoldersRouter);
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.message, code: err.code }, err.status as 400);
  }
  throw err;
});

function post(path: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockFolders.listForUser.mockReset();
  mockFolders.listForUser.mockResolvedValue([folderRow]);
  mockFolders.addDecks.mockClear();
  mockFolders.removeDecks.mockClear();
});

describe("POST /api/v1/deck-folders/:folderId/decks", () => {
  it("files every listed deck and returns the folders with fresh counts", async () => {
    const res = await post(`/api/v1/deck-folders/${FOLDER_ID}/decks`, {
      deckIds: [DECK_A, DECK_B],
    });

    expect(res.status).toBe(200);
    expect(mockFolders.addDecks).toHaveBeenCalledWith(FOLDER_ID, USER_ID, [DECK_A, DECK_B]);
    const json = await readJson<{ items: { id: string; deckCount: number }[] }>(res);
    expect(json.items).toEqual([expect.objectContaining({ id: FOLDER_ID, deckCount: 2 })]);
  });

  it("returns 404 for a folder the caller does not own", async () => {
    mockFolders.listForUser.mockResolvedValue([]);

    const res = await post(`/api/v1/deck-folders/${FOLDER_ID}/decks`, { deckIds: [DECK_A] });

    expect(res.status).toBe(404);
  });

  it("rejects an empty deck list", async () => {
    const res = await post(`/api/v1/deck-folders/${FOLDER_ID}/decks`, { deckIds: [] });

    expect(res.status).toBe(400);
    expect(mockFolders.addDecks).not.toHaveBeenCalled();
  });

  it("rejects an id that is not a uuid", async () => {
    const res = await post(`/api/v1/deck-folders/${FOLDER_ID}/decks`, { deckIds: ["deck-1"] });

    expect(res.status).toBe(400);
    expect(mockFolders.addDecks).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/deck-folders/:folderId/decks/remove", () => {
  it("takes every listed deck out of the folder", async () => {
    const res = await post(`/api/v1/deck-folders/${FOLDER_ID}/decks/remove`, {
      deckIds: [DECK_A, DECK_B],
    });

    expect(res.status).toBe(200);
    expect(mockFolders.removeDecks).toHaveBeenCalledWith(FOLDER_ID, USER_ID, [DECK_A, DECK_B]);
  });

  it("returns 404 for a folder the caller does not own", async () => {
    mockFolders.listForUser.mockResolvedValue([]);

    const res = await post(`/api/v1/deck-folders/${FOLDER_ID}/decks/remove`, {
      deckIds: [DECK_A],
    });

    expect(res.status).toBe(404);
  });
});
