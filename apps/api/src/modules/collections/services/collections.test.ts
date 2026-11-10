import { describe, expect, it, vi, beforeEach } from "vitest";

import type { Repos, Transact } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import {
  CANCEL_WITHOUT_ASKING,
  consentedTradeCancels,
  TradeCancelConsentRequiredError,
} from "../../groups/services/trade-supply.js";
import {
  clearCollection,
  deleteCollection,
  previewResetCollectionsTradeCancels,
  resetCollections,
} from "./collections.js";

function mockTransact(trxRepos: unknown): Transact {
  return (fn) => fn(trxRepos as any) as any;
}

function createMockRepos(
  overrides: {
    copies?: { id: string; printingId: string }[];
  } = {},
) {
  const copies = overrides.copies ?? [];
  const moveCopiesBetweenCollections = vi.fn(async () => {});
  const deleteByIdForUser = vi.fn(async () => {});
  const listCopiesInCollection = vi.fn(async () => copies);

  const repos = {
    collections: {
      lockById: vi.fn(async () => {}),
      listCopiesInCollection,
      moveCopiesBetweenCollections,
      deleteByIdForUser,
    },
    collectionEvents: {
      insert: vi.fn(async () => {}),
    },
    cardTrades: {
      listPendingPrintingIdsForGiver: vi.fn(async () => []),
    },
  } as unknown as Repos;

  return {
    repos,
    listCopiesInCollection,
    moveCopiesBetweenCollections,
    deleteByIdForUser,
  };
}

describe("deleteCollection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("deletes an empty collection without moving copies", async () => {
    const { repos, moveCopiesBetweenCollections, deleteByIdForUser } = createMockRepos({
      copies: [],
    });
    const transact = mockTransact(repos);

    await deleteCollection(
      transact,
      {
        collectionId: "col-1",
        collectionName: "Old Collection",
        moveCopiesTo: "col-2",
        targetName: "Target",
        userId: "user-1",
      },
      CANCEL_WITHOUT_ASKING,
    );

    expect(moveCopiesBetweenCollections).not.toHaveBeenCalled();
    expect(deleteByIdForUser).toHaveBeenCalledWith("col-1", "user-1");
  });

  it("moves copies to target collection before deleting", async () => {
    const { repos, moveCopiesBetweenCollections, deleteByIdForUser } = createMockRepos({
      copies: [
        { id: "copy-1", printingId: "p-1" },
        { id: "copy-2", printingId: "p-2" },
      ],
    });
    const transact = mockTransact(repos);

    await deleteCollection(
      transact,
      {
        collectionId: "col-1",
        collectionName: "Old Collection",
        moveCopiesTo: "col-2",
        targetName: "Target",
        userId: "user-1",
      },
      CANCEL_WITHOUT_ASKING,
    );

    expect(moveCopiesBetweenCollections).toHaveBeenCalledWith("col-1", "col-2");
    expect(deleteByIdForUser).toHaveBeenCalledWith("col-1", "user-1");
  });

  it("logs move events when copies are moved", async () => {
    const { repos } = createMockRepos({
      copies: [{ id: "copy-1", printingId: "p-1" }],
    });
    const transact = mockTransact(repos);
    const insertSpy = (repos as any).collectionEvents.insert;

    await deleteCollection(
      transact,
      {
        collectionId: "col-1",
        collectionName: "Old Collection",
        moveCopiesTo: "col-2",
        targetName: "Target",
        userId: "user-1",
      },
      CANCEL_WITHOUT_ASKING,
    );

    expect(insertSpy).toHaveBeenCalledTimes(1);
    const events = insertSpy.mock.calls[0][0];
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe("moved");
    expect(events[0].userId).toBe("user-1");
  });

  it("does not log events when collection is empty", async () => {
    const { repos } = createMockRepos({ copies: [] });
    const transact = mockTransact(repos);
    const insertSpy = (repos as any).collectionEvents.insert;

    await deleteCollection(
      transact,
      {
        collectionId: "col-1",
        collectionName: "Empty",
        moveCopiesTo: "col-2",
        targetName: "Target",
        userId: "user-1",
      },
      CANCEL_WITHOUT_ASKING,
    );

    expect(insertSpy).not.toHaveBeenCalled();
  });

  function withDoomedTrade(repos: Repos) {
    const markAutoCancelled = vi.fn(async () => 1);
    Object.assign(repos, {
      cardTrades: {
        listPendingPrintingIdsForGiver: vi.fn(async () => ["p-1"]),
        listPendingForGiverPrinting: vi.fn(async () => [
          { id: "trade-1", groupId: "group-1", quantity: 1, initiator: "receiver" },
        ]),
        listCancelSummaries: vi.fn(async (ids: string[]) => ids.map((id) => ({ id }))),
        markAutoCancelled,
      },
      friendGroupMatches: {
        giverPrintingSupply: vi.fn(async () => ({ unreservedCopyIds: [], hasAny: false })),
      },
    });
    return markAutoCancelled;
  }

  const deleteOpts = {
    collectionId: "col-1",
    collectionName: "Binder",
    moveCopiesTo: "inbox",
    targetName: "Inbox",
    userId: "user-1",
  };

  it("refuses when moving the copies to the inbox would cancel an unconfirmed trade", async () => {
    const { repos } = createMockRepos({ copies: [{ id: "copy-1", printingId: "p-1" }] });
    const markAutoCancelled = withDoomedTrade(repos);

    await expect(
      deleteCollection(mockTransact(repos), deleteOpts, consentedTradeCancels()),
    ).rejects.toBeInstanceOf(TradeCancelConsentRequiredError);
    expect(markAutoCancelled).not.toHaveBeenCalled();
  });

  it("cancels the trades a delete confirms", async () => {
    const { repos } = createMockRepos({ copies: [{ id: "copy-1", printingId: "p-1" }] });
    const markAutoCancelled = withDoomedTrade(repos);

    await deleteCollection(mockTransact(repos), deleteOpts, consentedTradeCancels(["trade-1"]));

    expect(markAutoCancelled).toHaveBeenCalledWith("trade-1");
  });
});

function createClearMockRepos(
  overrides: {
    copies?: { id: string; printingId: string }[];
    reservedIds?: string[];
    loanedIds?: string[];
  } = {},
) {
  const copies = overrides.copies ?? [];
  const deleteBatchById = vi.fn(async () => {});
  const insert = vi.fn(async () => {});

  const repos = {
    collections: {
      listCopiesInCollection: vi.fn(async () => copies),
      filterWritableByViewer: vi.fn(async (ids: string[]) => ids),
    },
    copies: {
      listWithCollectionContext: vi.fn(async (ids: string[]) =>
        copies
          .filter((copy) => ids.includes(copy.id))
          .map((copy) => ({ ...copy, collectionId: "col-1", collectionName: "Inbox" })),
      ),
      lockByIds: vi.fn(async (ids: string[]) => ids),
      deleteBatchById,
    },
    cardTrades: {
      filterReservedCopyIds: vi.fn(async (ids: string[]) =>
        (overrides.reservedIds ?? []).filter((id) => ids.includes(id)),
      ),
      listPendingForGiverPrinting: vi.fn(async () => []),
      listPendingPrintingIdsForGiver: vi.fn(async () => []),
    },
    loans: {
      filterLoanedCopyIds: vi.fn(async (ids: string[]) =>
        (overrides.loanedIds ?? []).filter((id) => ids.includes(id)),
      ),
    },
    collectionEvents: {
      insert,
    },
  } as unknown as Repos;

  return { repos, deleteBatchById, insert };
}

describe("clearCollection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns zero counts and disposes nothing for an empty collection", async () => {
    const { repos, deleteBatchById, insert } = createClearMockRepos({ copies: [] });

    const result = await clearCollection(
      mockTransact(repos),
      {
        collectionId: "col-1",
        userId: "user-1",
      },
      CANCEL_WITHOUT_ASKING,
    );

    expect(result).toEqual({ removedCount: 0, keptCopyIds: [] });
    expect(deleteBatchById).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("disposes every copy and logs removed events", async () => {
    const { repos, deleteBatchById, insert } = createClearMockRepos({
      copies: [
        { id: "copy-1", printingId: "p-1" },
        { id: "copy-2", printingId: "p-2" },
      ],
    });

    const result = await clearCollection(
      mockTransact(repos),
      {
        collectionId: "col-1",
        userId: "user-1",
      },
      CANCEL_WITHOUT_ASKING,
    );

    expect(result).toEqual({ removedCount: 2, keptCopyIds: [] });
    expect(deleteBatchById).toHaveBeenCalledWith(["copy-1", "copy-2"]);
    const events = (insert as any).mock.calls[0][0];
    expect(events).toHaveLength(2);
    expect(events[0].action).toBe("removed");
    expect(events[0].userId).toBe("user-1");
  });

  it("keeps copies pinned by trades or loans and reports them back", async () => {
    const { repos, deleteBatchById } = createClearMockRepos({
      copies: [
        { id: "copy-1", printingId: "p-1" },
        { id: "copy-2", printingId: "p-2" },
        { id: "copy-3", printingId: "p-3" },
      ],
      reservedIds: ["copy-1"],
      loanedIds: ["copy-2"],
    });

    const result = await clearCollection(
      mockTransact(repos),
      {
        collectionId: "col-1",
        userId: "user-1",
      },
      CANCEL_WITHOUT_ASKING,
    );

    expect(result.removedCount).toBe(1);
    expect(result.keptCopyIds.toSorted()).toEqual(["copy-1", "copy-2"]);
    expect(deleteBatchById).toHaveBeenCalledWith(["copy-3"]);
  });

  it("disposes nothing when every copy is pinned", async () => {
    const { repos, deleteBatchById, insert } = createClearMockRepos({
      copies: [{ id: "copy-1", printingId: "p-1" }],
      reservedIds: ["copy-1"],
    });

    const result = await clearCollection(
      mockTransact(repos),
      {
        collectionId: "col-1",
        userId: "user-1",
      },
      CANCEL_WITHOUT_ASKING,
    );

    expect(result).toEqual({ removedCount: 0, keptCopyIds: ["copy-1"] });
    expect(deleteBatchById).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("splits every id list of a large collection into bounded batches", async () => {
    const copies = Array.from({ length: 2500 }, (_, index) => ({
      id: `copy-${index}`,
      printingId: `p-${index % 7}`,
    }));
    const { repos, deleteBatchById } = createClearMockRepos({
      copies,
      reservedIds: ["copy-0"],
    });

    const result = await clearCollection(
      mockTransact(repos),
      {
        collectionId: "col-1",
        userId: "user-1",
      },
      CANCEL_WITHOUT_ASKING,
    );

    const idListCalls = [
      ...(repos.copies.lockByIds as any).mock.calls,
      ...(repos.copies.listWithCollectionContext as any).mock.calls,
      ...(repos.cardTrades.filterReservedCopyIds as any).mock.calls,
      ...(repos.loans.filterLoanedCopyIds as any).mock.calls,
      ...deleteBatchById.mock.calls,
    ] as [string[]][];
    expect(idListCalls.length).toBeGreaterThan(5);
    for (const [ids] of idListCalls) {
      expect(ids.length).toBeLessThanOrEqual(1000);
    }
    expect(deleteBatchById.mock.calls.flatMap(([ids]: any) => ids)).toHaveLength(2499);
    expect(result).toEqual({ removedCount: 2499, keptCopyIds: ["copy-0"] });
  });

  it("sweeps trades once, after the last batch, over every disposed printing", async () => {
    const copies = Array.from({ length: 2500 }, (_, index) => ({
      id: `copy-${index}`,
      printingId: `p-${index % 7}`,
    }));
    const { repos } = createClearMockRepos({ copies });

    await clearCollection(
      mockTransact(repos),
      { collectionId: "col-1", userId: "user-1" },
      consentedTradeCancels(),
    );

    const sweeps = (repos.cardTrades.listPendingPrintingIdsForGiver as any).mock.calls;
    expect(sweeps).toHaveLength(1);
    expect(sweeps[0][1].toSorted()).toEqual(["p-0", "p-1", "p-2", "p-3", "p-4", "p-5", "p-6"]);
  });
});

interface ResetCopy {
  id: string;
  printingId: string;
  collectionId: string;
  collectionName: string;
}

function createResetMocks(
  overrides: {
    copies?: ResetCopy[];
    reservedCopyIds?: string[];
    loanedCopyIds?: string[];
    listIdsWithEntries?: string[];
    removedCopies?: number;
    removedCollections?: number;
    removedLists?: number;
    pendingTrade?: boolean;
  } = {},
) {
  const copies = overrides.copies ?? [];
  const listInPersonalCollections = vi.fn(async () => copies);
  const deleteAllInPersonalCollections = vi.fn(
    async () => overrides.removedCopies ?? copies.length,
  );
  const deleteAllPersonalExceptInbox = vi.fn(async () => overrides.removedCollections ?? 0);
  const ensureInbox = vi.fn(async () => "inbox-1");
  const listIdsWithEntries = vi.fn(async () => overrides.listIdsWithEntries ?? []);
  const deleteEmptyWithoutRules = vi.fn(async () => overrides.removedLists ?? 0);
  const filterReservedCopyIds = vi.fn(
    async (_copyIds: string[]) => overrides.reservedCopyIds ?? [],
  );
  const filterLoanedCopyIds = vi.fn(async (_copyIds: string[]) => overrides.loanedCopyIds ?? []);
  const insertEvents = vi.fn(async (_events: unknown[]) => {});
  const doomed = overrides.pendingTrade ?? false;
  const listPendingPrintingIdsForGiver = vi.fn(async (_userId: string, ids: string[]) =>
    doomed ? ids : [],
  );
  const listPendingForGiverPrinting = vi.fn(async () =>
    doomed ? [{ id: "trade-1", groupId: "group-1", quantity: 1, initiator: "receiver" }] : [],
  );
  const markAutoCancelled = vi.fn(async (_id: string) => 1);

  const repos = {
    copies: {
      listInPersonalCollections,
      deleteAllInPersonalCollections,
      lockByIds: vi.fn(async (ids: string[]) => ids),
    },
    collections: { deleteAllPersonalExceptInbox, ensureInbox },
    lists: { listIdsWithEntries, deleteEmptyWithoutRules },
    cardTrades: {
      filterReservedCopyIds,
      listPendingForGiverPrinting,
      listPendingPrintingIdsForGiver,
      listCancelSummaries: vi.fn(async (ids: string[]) => ids.map((id) => ({ id }))),
      markAutoCancelled,
    },
    friendGroupMatches: {
      giverPrintingSupply: vi.fn(async () => ({ unreservedCopyIds: [], hasAny: false })),
    },
    loans: { filterLoanedCopyIds },
    collectionEvents: { insert: insertEvents },
  } as unknown as Repos;

  return {
    repos,
    listPendingPrintingIdsForGiver,
    markAutoCancelled,
    listInPersonalCollections,
    deleteAllInPersonalCollections,
    deleteAllPersonalExceptInbox,
    ensureInbox,
    listIdsWithEntries,
    deleteEmptyWithoutRules,
    filterReservedCopyIds,
    filterLoanedCopyIds,
    insertEvents,
  };
}

function resetCopy(n: number): ResetCopy {
  return {
    id: `copy-${n}`,
    printingId: `p-${n}`,
    collectionId: "col-1",
    collectionName: "Binder",
  };
}

describe("resetCollections", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("wipes copies, deletes non-inbox collections, ensures the inbox, and returns counts", async () => {
    const mocks = createResetMocks({
      copies: [resetCopy(1), resetCopy(2)],
      removedCopies: 2,
      removedCollections: 3,
      removedLists: 1,
    });
    const transact = mockTransact(mocks.repos);

    const result = await resetCollections(transact, "user-1", CANCEL_WITHOUT_ASKING);

    expect(result).toEqual({ removedCopies: 2, removedCollections: 3, removedLists: 1 });
    expect(mocks.deleteAllInPersonalCollections).toHaveBeenCalledWith("user-1");
    expect(mocks.deleteAllPersonalExceptInbox).toHaveBeenCalledWith("user-1");
    expect(mocks.ensureInbox).toHaveBeenCalledWith("user-1");
  });

  it("logs a removal event per copy before deleting", async () => {
    const mocks = createResetMocks({ copies: [resetCopy(1), resetCopy(2)] });
    const transact = mockTransact(mocks.repos);

    await resetCollections(transact, "user-1", CANCEL_WITHOUT_ASKING);

    expect(mocks.insertEvents).toHaveBeenCalledTimes(1);
    const events = mocks.insertEvents.mock.calls[0]![0] as any[];
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      userId: "user-1",
      action: "removed",
      copyId: "copy-1",
      printingId: "p-1",
      fromCollectionId: "col-1",
      fromCollectionName: "Binder",
    });
    expect(mocks.insertEvents.mock.invocationCallOrder[0]!).toBeLessThan(
      mocks.deleteAllInPersonalCollections.mock.invocationCallOrder[0]!,
    );
  });

  it("logs no events and prunes no lists for a user with no copies", async () => {
    const mocks = createResetMocks({ copies: [], listIdsWithEntries: [] });
    const transact = mockTransact(mocks.repos);

    const result = await resetCollections(transact, "user-1", CANCEL_WITHOUT_ASKING);

    expect(mocks.insertEvents).not.toHaveBeenCalled();
    expect(mocks.deleteEmptyWithoutRules).toHaveBeenCalledWith("user-1", []);
    expect(result.removedCopies).toBe(0);
  });

  it("only prunes lists that had entries before the wipe", async () => {
    const mocks = createResetMocks({
      copies: [resetCopy(1)],
      listIdsWithEntries: ["list-1", "list-2"],
    });
    const transact = mockTransact(mocks.repos);

    await resetCollections(transact, "user-1", CANCEL_WITHOUT_ASKING);

    expect(mocks.listIdsWithEntries).toHaveBeenCalledWith("user-1");
    expect(mocks.deleteEmptyWithoutRules).toHaveBeenCalledWith("user-1", ["list-1", "list-2"]);
    expect(mocks.listIdsWithEntries.mock.invocationCallOrder[0]!).toBeLessThan(
      mocks.deleteAllInPersonalCollections.mock.invocationCallOrder[0]!,
    );
  });

  it("refuses with 409 when a copy is reserved in an active trade", async () => {
    const mocks = createResetMocks({
      copies: [resetCopy(1)],
      reservedCopyIds: ["copy-1"],
    });
    const transact = mockTransact(mocks.repos);

    await expect(resetCollections(transact, "user-1", CANCEL_WITHOUT_ASKING)).rejects.toMatchObject(
      {
        status: 409,
      },
    );
    await expect(
      resetCollections(transact, "user-1", CANCEL_WITHOUT_ASKING),
    ).rejects.toBeInstanceOf(AppError);
    expect(mocks.deleteAllInPersonalCollections).not.toHaveBeenCalled();
    expect(mocks.insertEvents).not.toHaveBeenCalled();
  });

  it("refuses with 409 when a copy is out on a loan", async () => {
    const mocks = createResetMocks({
      copies: [resetCopy(1)],
      loanedCopyIds: ["copy-1"],
    });
    const transact = mockTransact(mocks.repos);

    await expect(resetCollections(transact, "user-1", CANCEL_WITHOUT_ASKING)).rejects.toMatchObject(
      {
        status: 409,
      },
    );
    expect(mocks.deleteAllInPersonalCollections).not.toHaveBeenCalled();
  });

  it("chunks guard checks and event inserts for large collections", async () => {
    const copies = Array.from({ length: 2500 }, (_, i) => resetCopy(i));
    const mocks = createResetMocks({ copies });
    const transact = mockTransact(mocks.repos);

    await resetCollections(transact, "user-1", CANCEL_WITHOUT_ASKING);

    expect(mocks.filterReservedCopyIds).toHaveBeenCalledTimes(3);
    expect(mocks.filterLoanedCopyIds).toHaveBeenCalledTimes(3);
    expect(mocks.insertEvents).toHaveBeenCalledTimes(3);
    expect(mocks.filterReservedCopyIds.mock.calls[0]![0] as string[]).toHaveLength(1000);
    expect(mocks.filterReservedCopyIds.mock.calls[2]![0] as string[]).toHaveLength(500);
  });

  it("refuses when the wipe would cancel an unconfirmed trade", async () => {
    const mocks = createResetMocks({ copies: [resetCopy(1)], pendingTrade: true });

    await expect(
      resetCollections(mockTransact(mocks.repos), "user-1", consentedTradeCancels()),
    ).rejects.toBeInstanceOf(TradeCancelConsentRequiredError);
    expect(mocks.markAutoCancelled).not.toHaveBeenCalled();
  });

  it("cancels the trades a reset confirms, after the copies are gone", async () => {
    const mocks = createResetMocks({ copies: [resetCopy(1)], pendingTrade: true });

    await resetCollections(mockTransact(mocks.repos), "user-1", consentedTradeCancels(["trade-1"]));

    expect(mocks.markAutoCancelled).toHaveBeenCalledWith("trade-1");
    expect(mocks.deleteAllInPersonalCollections.mock.invocationCallOrder[0]!).toBeLessThan(
      mocks.listPendingPrintingIdsForGiver.mock.invocationCallOrder[0]!,
    );
  });

  it("sweeps trades once, after every batch, over every removed printing", async () => {
    const copies = Array.from({ length: 2500 }, (_, i) => ({
      ...resetCopy(i),
      printingId: `p-${i % 7}`,
    }));
    const mocks = createResetMocks({ copies });

    await resetCollections(mockTransact(mocks.repos), "user-1", consentedTradeCancels());

    const sweeps = mocks.listPendingPrintingIdsForGiver.mock.calls;
    expect(sweeps).toHaveLength(1);
    expect(sweeps[0]![1].toSorted()).toEqual(["p-0", "p-1", "p-2", "p-3", "p-4", "p-5", "p-6"]);
  });

  it("refuses for a reserved copy before sweeping", async () => {
    const mocks = createResetMocks({
      copies: [resetCopy(1)],
      reservedCopyIds: ["copy-1"],
      pendingTrade: true,
    });

    await expect(
      resetCollections(mockTransact(mocks.repos), "user-1", consentedTradeCancels(["trade-1"])),
    ).rejects.toBeInstanceOf(AppError);
    expect(mocks.listPendingPrintingIdsForGiver).not.toHaveBeenCalled();
  });

  it("previews the trades a reset would cancel inside a transaction that rolls back", async () => {
    const mocks = createResetMocks({ copies: [resetCopy(1)], pendingTrade: true });
    let outcome: "committed" | "rolled back" | undefined;
    const transact: Transact = async (fn) => {
      try {
        const result = await fn(mocks.repos as any);
        outcome = "committed";
        return result;
      } catch (error) {
        outcome = "rolled back";
        throw error;
      }
    };

    const preview = await previewResetCollectionsTradeCancels(transact, "user-1");

    expect(preview).toEqual({ trades: [{ id: "trade-1" }] });
    expect(outcome).toBe("rolled back");
  });
});
