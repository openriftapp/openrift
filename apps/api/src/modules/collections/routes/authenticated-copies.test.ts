import { Hono } from "hono";
import { describe, expect, it, beforeEach, vi } from "vitest";

import { AppError } from "../../../errors.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { copiesRouter } from "./authenticated-copies";

const mockRepo = {
  listForAccessibleCollections: vi.fn(() => Promise.resolve([] as object[])),
  listChangedForAccessibleCollections: vi.fn(() => Promise.resolve([] as object[])),
  deletionsSince: vi.fn(() => Promise.resolve([] as { copyId: string; deletedXid: string }[])),
  currentSafeXid: vi.fn(() => Promise.resolve("5000")),
  prunedThroughXid: vi.fn(() => Promise.resolve("100")),
};

const mockAddCopies = vi.fn(() => Promise.resolve([] as object[]));
const mockMoveCopies = vi.fn(() => Promise.resolve());
const mockDisposeCopies = vi.fn(() => Promise.resolve());

const USER_ID = "a0000000-0001-4000-a000-000000000001";

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  // oxlint-disable-next-line no-explicit-any -- test stubs don't match full types
  c.set("user", { id: USER_ID } as any);
  // oxlint-disable-next-line no-explicit-any -- test mock doesn't match full Repos type
  c.set("repos", { copies: mockRepo } as any);
  // oxlint-disable-next-line no-explicit-any -- test stub
  c.set("transact", (() => {}) as any);
  c.set("services", {
    addCopies: mockAddCopies,
    moveCopies: mockMoveCopies,
    disposeCopies: mockDisposeCopies,
    // oxlint-disable-next-line no-explicit-any -- test mock doesn't match full Services type
  } as any);
  await next();
});
registerRouterForTest(app, copiesRouter);
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.message, code: err.code }, err.status as 400);
  }
  throw err;
});

const now = new Date("2026-03-17T00:00:00Z");

const dbCopy = {
  id: "a0000000-0001-4000-a000-000000000020",
  printingId: "OGS-001:rare:normal:",
  collectionId: "a0000000-0001-4000-a000-000000000010",
  groupId: null,
  onLoan: false,
  reserved: false,
  createdAt: now,
  condition: null,
  grader: null,
  grade: null,
  notesPublic: null,
  notesPrivate: null,
  isAltered: false,
  links: [],
};

const COPY_ID = "a0000000-0001-4000-a000-000000000020";
const PRINTING_ID = "a0000000-0001-4000-a000-000000000030";
const COLLECTION_ID = "a0000000-0001-4000-a000-000000000010";

describe("GET /api/v1/copies", () => {
  beforeEach(() => {
    mockRepo.listForAccessibleCollections.mockReset();
  });

  it("returns 200 with list of copies", async () => {
    mockRepo.listForAccessibleCollections.mockResolvedValue([dbCopy]);
    const res = await app.request("/api/v1/copies");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.items).toHaveLength(1);
    expect(json.items[0].id).toBe(dbCopy.id);
    expect(json.nextCursor).toBeNull();
  });

  it("returns empty array when no copies", async () => {
    mockRepo.listForAccessibleCollections.mockResolvedValue([]);
    const res = await app.request("/api/v1/copies");
    const json = await readJson(res);
    expect(json.items).toEqual([]);
    expect(json.nextCursor).toBeNull();
  });

  it("returns nextCursor when hasMore with explicit limit", async () => {
    const items = Array.from({ length: 11 }, (_, i) => ({
      ...dbCopy,
      id: `a0000000-0001-4000-a000-${String(i).padStart(12, "0")}`,
      createdAt: new Date(now.getTime() - i * 1000),
    }));
    mockRepo.listForAccessibleCollections.mockResolvedValue(items);
    const res = await app.request("/api/v1/copies?limit=10");
    const json = await readJson(res);
    expect(json.items).toHaveLength(10);
    expect(json.nextCursor).toBeTruthy();
  });

  it("caps results at the default page size when none is provided", async () => {
    const items = Array.from({ length: 5001 }, (_, i) => ({
      ...dbCopy,
      id: `a0000000-0001-4000-a000-${String(i).padStart(12, "0")}`,
      createdAt: new Date(now.getTime() - i * 1000),
    }));
    mockRepo.listForAccessibleCollections.mockResolvedValue(items);
    const res = await app.request("/api/v1/copies");
    const json = await readJson(res);
    expect(json.items).toHaveLength(5000);
    expect(json.nextCursor).toBeTruthy();
  });

  it("passes cursor and limit to repo", async () => {
    mockRepo.listForAccessibleCollections.mockResolvedValue([]);
    await app.request("/api/v1/copies?limit=10&cursor=2026-03-17T00:00:00.000Z");
    expect(mockRepo.listForAccessibleCollections).toHaveBeenCalledWith(
      USER_ID,
      10,
      "2026-03-17T00:00:00.000Z",
    );
  });
});

describe("GET /api/v1/copies with a watermark", () => {
  const DELETED_ID = "a0000000-0001-4000-a000-000000000021";

  beforeEach(() => {
    mockRepo.listForAccessibleCollections.mockReset();
    mockRepo.listChangedForAccessibleCollections.mockReset();
    mockRepo.deletionsSince.mockReset();
    mockRepo.currentSafeXid.mockReset();
    mockRepo.prunedThroughXid.mockReset();
    mockRepo.listForAccessibleCollections.mockResolvedValue([]);
    mockRepo.listChangedForAccessibleCollections.mockResolvedValue([]);
    mockRepo.deletionsSince.mockResolvedValue([]);
    mockRepo.currentSafeXid.mockResolvedValue("5000");
    mockRepo.prunedThroughXid.mockResolvedValue("100");
  });

  it("returns what changed and what was deleted since the watermark", async () => {
    mockRepo.listChangedForAccessibleCollections.mockResolvedValue([
      { ...dbCopy, updatedXid: "4200" },
    ]);
    mockRepo.deletionsSince.mockResolvedValue([{ copyId: DELETED_ID, deletedXid: "4300" }]);

    const res = await app.request("/api/v1/copies?since=1000");

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.items).toHaveLength(1);
    expect(json.deletedIds).toEqual([DELETED_ID]);
    expect(json.syncedXid).toBe("5000");
    expect(mockRepo.listForAccessibleCollections).not.toHaveBeenCalled();
  });

  it("reads only transactions that have finished, so one still in flight is not skipped", async () => {
    await app.request("/api/v1/copies?since=1000");

    expect(mockRepo.listChangedForAccessibleCollections).toHaveBeenCalledWith(
      USER_ID,
      "1000",
      "5000",
      expect.any(Number),
      undefined,
    );
  });

  it("withholds the watermark and hands back a cursor while a page is full", async () => {
    const rows = Array.from({ length: 11 }, (_, index) => ({
      ...dbCopy,
      id: `a0000000-0001-4000-a000-${String(index).padStart(12, "0")}`,
      updatedXid: String(4000 + index),
    }));
    mockRepo.listChangedForAccessibleCollections.mockResolvedValue(rows);

    const res = await app.request("/api/v1/copies?limit=10&since=1000");

    const json = await readJson(res);
    expect(json.items).toHaveLength(10);
    expect(json.syncedXid).toBeUndefined();
    expect(json.nextDeltaCursor).toBe("5000~4009_a0000000-0001-4000-a000-000000000009~");
  });

  it("resumes from the cursor's keyset and keeps its pinned watermark", async () => {
    mockRepo.currentSafeXid.mockResolvedValue("6000");
    const cursor = "5000~4009_a0000000-0001-4000-a000-000000000009~";

    await app.request(`/api/v1/copies?since=1000&deltaCursor=${encodeURIComponent(cursor)}`);

    expect(mockRepo.listChangedForAccessibleCollections).toHaveBeenCalledWith(
      USER_ID,
      "1000",
      "5000",
      expect.any(Number),
      { xid: "4009", id: "a0000000-0001-4000-a000-000000000009" },
    );
  });

  it("clamps a cursor whose watermark runs ahead of the server's", async () => {
    const cursor = "9999~4009_a0000000-0001-4000-a000-000000000009~";

    await app.request(`/api/v1/copies?since=1000&deltaCursor=${encodeURIComponent(cursor)}`);

    expect(mockRepo.listChangedForAccessibleCollections).toHaveBeenCalledWith(
      USER_ID,
      "1000",
      "5000",
      expect.any(Number),
      { xid: "4009", id: "a0000000-0001-4000-a000-000000000009" },
    );
  });

  it("falls back to a full read when the watermark runs ahead of the server's", async () => {
    mockRepo.listForAccessibleCollections.mockResolvedValue([dbCopy]);

    const res = await app.request("/api/v1/copies?since=9999");

    const json = await readJson(res);
    expect(json.items).toHaveLength(1);
    expect(json.syncedXid).toBe("5000");
    expect(mockRepo.listForAccessibleCollections).toHaveBeenCalled();
    expect(mockRepo.listChangedForAccessibleCollections).not.toHaveBeenCalled();
  });

  it("falls back to a full read when the watermark predates the pruned tombstones", async () => {
    mockRepo.prunedThroughXid.mockResolvedValue("2000");
    mockRepo.listForAccessibleCollections.mockResolvedValue([dbCopy]);

    const res = await app.request("/api/v1/copies?since=1000");

    const json = await readJson(res);
    expect(json.items).toHaveLength(1);
    expect(json.deletedIds).toBeUndefined();
    expect(json.syncedXid).toBe("5000");
    expect(mockRepo.listChangedForAccessibleCollections).not.toHaveBeenCalled();
  });

  it("falls back to a full read when the sweep prunes past the watermark during the read", async () => {
    mockRepo.prunedThroughXid.mockResolvedValueOnce("100").mockResolvedValueOnce("2000");
    mockRepo.listChangedForAccessibleCollections.mockResolvedValue([
      { ...dbCopy, updatedXid: "4200" },
    ]);
    mockRepo.listForAccessibleCollections.mockResolvedValue([dbCopy]);

    const res = await app.request("/api/v1/copies?since=1000");

    const json = await readJson(res);
    expect(json.deletedIds).toBeUndefined();
    expect(json.syncedXid).toBe("5000");
    expect(mockRepo.listChangedForAccessibleCollections).toHaveBeenCalledOnce();
    expect(mockRepo.listForAccessibleCollections).toHaveBeenCalledOnce();
  });
});

describe("POST /api/v1/copies", () => {
  beforeEach(() => {
    mockAddCopies.mockReset();
  });

  it("returns 201 with created copies", async () => {
    const created = [
      {
        id: COPY_ID,
        printingId: PRINTING_ID,
        collectionId: COLLECTION_ID,
        groupId: null,
        condition: null,
        grader: null,
        grade: null,
        notesPublic: null,
        notesPrivate: null,
        isAltered: false,
        links: [],
        onLoan: false,
        reserved: false,
      },
    ];
    mockAddCopies.mockResolvedValue(created);
    const res = await app.request("/api/v1/copies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copies: [{ printingId: PRINTING_ID }] }),
    });
    expect(res.status).toBe(201);
    const json = await readJson(res);
    expect(json.items).toHaveLength(1);
  });
});

describe("POST /api/v1/copies/move", () => {
  beforeEach(() => {
    mockMoveCopies.mockReset();
  });

  it("returns 204 on successful move", async () => {
    mockMoveCopies.mockResolvedValue();
    const res = await app.request("/api/v1/copies/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copyIds: [COPY_ID], toCollectionId: COLLECTION_ID }),
    });
    expect(res.status).toBe(204);
  });
});

describe("POST /api/v1/copies/dispose", () => {
  beforeEach(() => {
    mockDisposeCopies.mockReset();
  });

  it("returns 204 on successful disposal", async () => {
    mockDisposeCopies.mockResolvedValue();
    const res = await app.request("/api/v1/copies/dispose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copyIds: [COPY_ID] }),
    });
    expect(res.status).toBe(204);
  });
});

describe("POST /api/v1/copies — service arguments", () => {
  beforeEach(() => {
    mockAddCopies.mockReset();
  });

  it("passes repos, transact, userId, and copies to addCopies service", async () => {
    mockAddCopies.mockResolvedValue([]);
    const copies = [{ printingId: PRINTING_ID, collectionId: COLLECTION_ID }];
    await app.request("/api/v1/copies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copies }),
    });
    expect(mockAddCopies).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      USER_ID,
      copies,
      { batchId: undefined },
    );
  });

  it("passes the batch id through to the service", async () => {
    mockAddCopies.mockResolvedValue([]);
    const copies = [{ printingId: PRINTING_ID, collectionId: COLLECTION_ID }];
    const batchId = "0191a9c4-2f3e-7c1d-9b4a-3f0c6d2e8a11";
    await app.request("/api/v1/copies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copies, batchId }),
    });
    expect(mockAddCopies).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      USER_ID,
      copies,
      { batchId },
    );
  });
});

describe("POST /api/v1/copies/move — service arguments", () => {
  beforeEach(() => {
    mockMoveCopies.mockReset();
  });

  it("passes repos, transact, userId, copyIds, and toCollectionId to moveCopies service", async () => {
    mockMoveCopies.mockResolvedValue(undefined);
    const copyIds = [COPY_ID];
    await app.request("/api/v1/copies/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copyIds, toCollectionId: COLLECTION_ID }),
    });
    expect(mockMoveCopies).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      USER_ID,
      copyIds,
      COLLECTION_ID,
    );
  });
});

describe("POST /api/v1/copies/dispose — service arguments", () => {
  beforeEach(() => {
    mockDisposeCopies.mockReset();
  });

  it("passes transact, userId, and copyIds to disposeCopies service", async () => {
    mockDisposeCopies.mockResolvedValue(undefined);
    const copyIds = [COPY_ID];
    await app.request("/api/v1/copies/dispose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copyIds }),
    });
    expect(mockDisposeCopies).toHaveBeenCalledWith(expect.anything(), USER_ID, copyIds);
  });
});

describe("GET /api/v1/copies — default limit", () => {
  beforeEach(() => {
    mockRepo.listForAccessibleCollections.mockReset();
  });

  it("passes the default page size to the repo when no limit is provided", async () => {
    mockRepo.listForAccessibleCollections.mockResolvedValue([]);
    await app.request("/api/v1/copies");
    expect(mockRepo.listForAccessibleCollections).toHaveBeenCalledWith(USER_ID, 5000, undefined);
  });
});
