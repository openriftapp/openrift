import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../../errors.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { collectionsRouter } from "./authenticated-collections.js";
import { copiesRouter } from "./authenticated-copies.js";

const USER_ID = "a0000000-0001-4000-a000-000000000001";
const SOURCE_ID = "a0000000-0001-4000-a000-000000000010";
const TARGET_ID = "a0000000-0001-4000-a000-000000000011";
const INBOX_ID = "a0000000-0001-4000-a000-000000000012";
const COPY_ID = "a0000000-0001-4000-a000-000000000020";
const PRINTING_ID = "a0000000-0001-4000-a000-000000000030";
const CARD_ID = "a0000000-0001-4000-a000-000000000031";
const TRADE_ID = "e0000000-0001-4000-a000-000000000001";
const OTHER_TRADE_ID = "e0000000-0001-4000-a000-000000000099";

const summary = {
  id: TRADE_ID,
  cardId: CARD_ID,
  printingId: PRINTING_ID,
  quantity: 1,
  counterpartyName: "Mara",
};

const sourceCollection = {
  id: SOURCE_ID,
  userId: USER_ID,
  groupId: null,
  name: "Main Binder",
  isInbox: false,
  groupSlug: null,
  groupName: null,
};

const markAutoCancelled = vi.fn((_id: string) => Promise.resolve(1));

const repos = {
  collections: {
    filterWritableByViewer: vi.fn((ids: readonly string[]) => Promise.resolve([...ids])),
    listIdNameGroupByIds: vi.fn(() =>
      Promise.resolve([{ id: TARGET_ID, name: "Trade Binder", groupId: null }]),
    ),
    lockAsMoveTarget: vi.fn(() => Promise.resolve(true)),
    getAccessForUser: vi.fn(() =>
      Promise.resolve({ collection: sourceCollection, viewerRole: "owner", viewerCanAdmin: true }),
    ),
    lockById: vi.fn(() => Promise.resolve()),
    listCopiesInCollection: vi.fn(() =>
      Promise.resolve([{ id: COPY_ID, printingId: PRINTING_ID }]),
    ),
    moveCopiesBetweenCollections: vi.fn(() => Promise.resolve()),
    deleteByIdForUser: vi.fn(() => Promise.resolve()),
    deleteAllPersonalExceptInbox: vi.fn(() => Promise.resolve(1)),
    ensureInbox: vi.fn(() => Promise.resolve(INBOX_ID)),
  },
  copies: {
    lockByIds: vi.fn((ids: string[]) => Promise.resolve(ids)),
    listWithCollectionContext: vi.fn((ids: readonly string[]) =>
      Promise.resolve(
        ids.map((id) => ({
          id,
          printingId: PRINTING_ID,
          collectionId: SOURCE_ID,
          collectionName: "Main Binder",
        })),
      ),
    ),
    moveBatchById: vi.fn(() => Promise.resolve()),
    deleteBatchById: vi.fn(() => Promise.resolve()),
    listInPersonalCollections: vi.fn(() =>
      Promise.resolve([
        {
          id: COPY_ID,
          printingId: PRINTING_ID,
          collectionId: SOURCE_ID,
          collectionName: "Main Binder",
        },
      ]),
    ),
    deleteAllInPersonalCollections: vi.fn(() => Promise.resolve(1)),
  },
  collectionEvents: { insert: vi.fn(() => Promise.resolve()) },
  loans: { filterLoanedCopyIds: vi.fn(() => Promise.resolve([])) },
  lists: {
    deleteTradeEntriesForCopies: vi.fn(() => Promise.resolve({ numDeletedRows: 0n })),
    listIdsWithEntries: vi.fn(() => Promise.resolve([])),
    deleteEmptyWithoutRules: vi.fn(() => Promise.resolve(0)),
    removeCollectionFromRules: vi.fn(() => Promise.resolve()),
  },
  cardTrades: {
    filterReservedCopyIds: vi.fn(() => Promise.resolve([])),
    listReservationsForCopies: vi.fn(() => Promise.resolve([])),
    listPendingPrintingIdsForGiver: vi.fn(() => Promise.resolve([PRINTING_ID])),
    listPendingForGiverPrinting: vi.fn(() =>
      Promise.resolve([{ id: TRADE_ID, groupId: "group-1", quantity: 1, initiator: "receiver" }]),
    ),
    listCancelSummaries: vi.fn((ids: readonly string[]) =>
      Promise.resolve(ids.includes(TRADE_ID) ? [summary] : []),
    ),
    markAutoCancelled,
  },
  friendGroupMatches: {
    giverPrintingSupply: vi.fn(() => Promise.resolve({ unreservedCopyIds: [], hasAny: false })),
  },
};

const transact = vi.fn((fn: (trxRepos: unknown) => Promise<unknown>) => fn(repos));

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: USER_ID } as never);
  c.set("repos", repos as never);
  c.set("transact", transact as never);
  c.set("services", { ensureInbox: () => Promise.resolve(INBOX_ID) } as never);
  await next();
});
registerRouterForTest(app, { copies: copiesRouter, collections: collectionsRouter });
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.message, code: err.code }, err.status as 400);
  }
  throw err;
});

function send(path: string, method: string, body: Record<string, unknown>) {
  return app.request(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const writes = [
  {
    name: "moving copies",
    path: "/api/v1/copies/move",
    method: "POST",
    body: { copyIds: [COPY_ID], toCollectionId: TARGET_ID },
    status: 204,
  },
  {
    name: "disposing copies",
    path: "/api/v1/copies/dispose",
    method: "POST",
    body: { copyIds: [COPY_ID] },
    status: 204,
  },
  {
    name: "deleting a collection",
    path: `/api/v1/collections/${SOURCE_ID}`,
    method: "DELETE",
    body: {},
    status: 204,
  },
  {
    name: "clearing a collection",
    path: `/api/v1/collections/${SOURCE_ID}/clear`,
    method: "POST",
    body: {},
    status: 200,
  },
  {
    name: "resetting all collections",
    path: "/api/v1/collections/reset",
    method: "POST",
    body: {},
    status: 200,
  },
];

const checks = [
  {
    name: "moving copies",
    path: "/api/v1/copies/trade-cancels/move",
    body: { copyIds: [COPY_ID], toCollectionId: TARGET_ID },
  },
  {
    name: "disposing copies",
    path: "/api/v1/copies/trade-cancels/dispose",
    body: { copyIds: [COPY_ID] },
  },
  {
    name: "deleting a collection",
    path: `/api/v1/collections/${SOURCE_ID}/trade-cancels/delete`,
    body: {},
  },
  {
    name: "clearing a collection",
    path: `/api/v1/collections/${SOURCE_ID}/trade-cancels/clear`,
    body: {},
  },
  {
    name: "resetting all collections",
    path: "/api/v1/collections/trade-cancels/reset",
    body: {},
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  repos.cardTrades.listPendingPrintingIdsForGiver.mockResolvedValue([PRINTING_ID]);
});

describe("collection writes that cancel pending trades (ADR-019)", () => {
  it.each(writes)("$name refuses with the trades it would cancel when unconfirmed", async (w) => {
    const res = await send(w.path, w.method, w.body);

    expect(res.status).toBe(409);
    expect(await readJson(res)).toMatchObject({
      defined: true,
      code: "CONFLICT",
      data: { trades: [summary] },
    });
    expect(markAutoCancelled).not.toHaveBeenCalled();
  });

  it.each(writes)("$name cancels the trades the request confirms", async (w) => {
    const res = await send(w.path, w.method, { ...w.body, cancelTradeIds: [TRADE_ID] });

    expect(res.status).toBe(w.status);
    expect(markAutoCancelled).toHaveBeenCalledWith(TRADE_ID);
  });

  it.each(writes)("$name refuses when the confirmation names other trades", async (w) => {
    const res = await send(w.path, w.method, { ...w.body, cancelTradeIds: [OTHER_TRADE_ID] });

    expect(res.status).toBe(409);
    expect(markAutoCancelled).not.toHaveBeenCalled();
  });

  it("keeps a plain conflict untyped when a copy is reserved for a group move", async () => {
    repos.collections.listIdNameGroupByIds.mockResolvedValueOnce([
      { id: TARGET_ID, name: "Friday Night Pool", groupId: "group-1" as never },
    ]);
    repos.cardTrades.filterReservedCopyIds.mockResolvedValueOnce([COPY_ID] as never);

    const res = await send("/api/v1/copies/move", "POST", {
      copyIds: [COPY_ID],
      toCollectionId: TARGET_ID,
    });

    expect(res.status).toBe(409);
    expect(await readJson(res)).toMatchObject({ defined: false, code: "CONFLICT" });
  });

  it("accepts a reset sent without a body when nothing would be cancelled", async () => {
    repos.cardTrades.listPendingPrintingIdsForGiver.mockResolvedValue([]);

    const bare = await app.request("/api/v1/collections/reset", { method: "POST" });
    const jsonHeaderOnly = await app.request("/api/v1/collections/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    expect(bare.status).toBe(200);
    expect(jsonHeaderOnly.status).toBe(200);
    expect(repos.copies.deleteAllInPersonalCollections).toHaveBeenCalledWith(USER_ID);
  });

  it("refuses a reset with a plain conflict while a copy is reserved, before any sweep", async () => {
    repos.cardTrades.filterReservedCopyIds.mockResolvedValueOnce([COPY_ID] as never);

    const res = await send("/api/v1/collections/reset", "POST", { cancelTradeIds: [TRADE_ID] });

    expect(res.status).toBe(409);
    expect(await readJson(res)).toMatchObject({
      defined: false,
      code: "CONFLICT",
      message: expect.stringContaining("reserved in active trades"),
    });
    expect(repos.copies.deleteAllInPersonalCollections).not.toHaveBeenCalled();
    expect(markAutoCancelled).not.toHaveBeenCalled();
  });
});

describe("trade-cancel checks", () => {
  it.each(checks)("$name lists the trades the write would cancel", async (check) => {
    const res = await send(check.path, "POST", check.body);

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ trades: [summary] });
    expect(repos.cardTrades.listCancelSummaries).toHaveBeenCalledWith([TRADE_ID]);
  });

  it.each(checks)("$name answers with no trades when nothing would be cancelled", async (check) => {
    repos.cardTrades.listPendingPrintingIdsForGiver.mockResolvedValue([]);

    const res = await send(check.path, "POST", check.body);

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ trades: [] });
    expect(markAutoCancelled).not.toHaveBeenCalled();
  });

  it("checks the move under the same ownership rule as the write", async () => {
    repos.copies.listWithCollectionContext.mockResolvedValueOnce([]);

    const res = await send("/api/v1/copies/trade-cancels/move", "POST", {
      copyIds: [COPY_ID],
      toCollectionId: TARGET_ID,
    });

    expect(res.status).toBe(404);
  });

  it("checks a collection delete under the admin rule of the write", async () => {
    repos.collections.getAccessForUser.mockResolvedValueOnce({
      collection: sourceCollection,
      viewerRole: "member",
      viewerCanAdmin: false,
    });

    const res = await send(`/api/v1/collections/${SOURCE_ID}/trade-cancels/delete`, "POST", {});

    expect(res.status).toBe(403);
  });

  it("checks a selection larger than one write in write-sized chunks", async () => {
    const copyIds = Array.from(
      { length: 501 },
      (_, index) => `a0000000-0001-4000-b000-${String(index).padStart(12, "0")}`,
    );

    const res = await send("/api/v1/copies/trade-cancels/dispose", "POST", { copyIds });

    expect(res.status).toBe(200);
    expect(repos.copies.deleteBatchById).toHaveBeenCalledTimes(2);
    expect(transact).toHaveBeenCalledTimes(1);
  });
});
