/* oxlint-disable
   no-empty-function,
   unicorn/no-useless-undefined
   -- test file: mocks require empty fns and explicit undefined */
import type { ListIntent, ListKind } from "@openrift/shared/types/api/list";
import type { DeleteResult, Selectable } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { ListsTable } from "../../../db/tables/lists.js";
import type { Repos, Transact } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import type { MoveEntry } from "../repositories/lists-entries.js";
import { moveListEntries } from "./lists.js";

function mockTransact(trxRepos: Repos): Transact {
  return (fn) => fn(trxRepos) as any;
}

function buildList(
  overrides: Partial<Selectable<ListsTable>> & { id: string; kind: ListKind; intent: ListIntent },
): Selectable<ListsTable> {
  return {
    userId: "user-1",
    name: overrides.id,
    isPublic: false,
    shareToken: null,
    defaultPricePref: null,
    defaultPriceAbsoluteCents: null,
    defaultTradeType: null,
    currency: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Selectable<ListsTable>;
}

function buildEntry(overrides: Pick<MoveEntry, "id" | "kind"> & Partial<MoveEntry>): MoveEntry {
  return {
    id: overrides.id,
    kind: overrides.kind,
    cardId: overrides.cardId ?? null,
    printingId: overrides.printingId ?? null,
    copyId: overrides.copyId ?? null,
    quantity: overrides.quantity ?? 1,
    pricePref: overrides.pricePref ?? null,
    priceAbsoluteCents: overrides.priceAbsoluteCents ?? null,
    tradeType: overrides.tradeType ?? null,
    resolvedPrintingId: overrides.resolvedPrintingId ?? overrides.printingId ?? null,
    resolvedCardId: overrides.resolvedCardId ?? overrides.cardId ?? null,
  };
}

interface OwnedCopy {
  copyId: string;
  printingId: string;
  cardId: string;
}

interface MockOverrides {
  source?: ReturnType<typeof buildList>;
  destination?: ReturnType<typeof buildList>;
  entries?: ReturnType<typeof buildEntry>[];
  bulkResult?: { inserted: number; updated: number };
  deleteCount?: number;
  ownedCopies?: OwnedCopy[];
  printings?: { id: string; cardId: string }[];
}

function createMockRepos(overrides: MockOverrides = {}) {
  const bulkCreateEntries = vi
    .fn()
    .mockResolvedValue(
      overrides.bulkResult ?? { inserted: overrides.entries?.length ?? 0, updated: 0 },
    );
  const deleteEntriesByIds = vi.fn().mockResolvedValue({
    numDeletedRows: BigInt(overrides.deleteCount ?? overrides.entries?.length ?? 0),
  } as DeleteResult);
  const entriesForMove = vi.fn().mockResolvedValue(overrides.entries ?? []);
  const ownedCopyTargets = vi.fn().mockResolvedValue(overrides.ownedCopies ?? []);
  const printingCardIds = vi.fn().mockResolvedValue(overrides.printings ?? []);
  const getByIdForUser = vi.fn().mockImplementation((id: string) => {
    if (overrides.source && id === overrides.source.id) {
      return Promise.resolve(overrides.source);
    }
    if (overrides.destination && id === overrides.destination.id) {
      return Promise.resolve(overrides.destination);
    }
    return Promise.resolve(undefined);
  });

  const repos = {
    lists: {
      getByIdForUser,
      entriesForMove,
      bulkCreateEntries,
      deleteEntriesByIds,
      ownedCopyTargets,
      printingCardIds,
    },
  } as unknown as Repos;

  return {
    repos,
    bulkCreateEntries,
    deleteEntriesByIds,
    entriesForMove,
    getByIdForUser,
    ownedCopyTargets,
  };
}

function firstInsert(bulkCreateEntries: ReturnType<typeof vi.fn>) {
  return bulkCreateEntries.mock.calls[0] as [string, Record<string, unknown>[]];
}

describe("moveListEntries", () => {
  it("rejects when source and destination are the same list", async () => {
    const { repos } = createMockRepos();
    await expect(
      moveListEntries(repos, mockTransact(repos), "user-1", "list-a", "list-a", ["entry-1"]),
    ).rejects.toThrow(/Source and destination must differ/u);
  });

  it("rejects when the source list is missing", async () => {
    const destination = buildList({ id: "list-b", kind: "card", intent: "wish" });
    const { repos } = createMockRepos({ destination });
    await expect(
      moveListEntries(repos, mockTransact(repos), "user-1", "list-a", "list-b", ["entry-1"]),
    ).rejects.toThrow(AppError);
  });

  it("rejects when the destination list is missing", async () => {
    const source = buildList({ id: "list-a", kind: "card", intent: "wish" });
    const { repos } = createMockRepos({ source });
    await expect(
      moveListEntries(repos, mockTransact(repos), "user-1", "list-a", "list-b", ["entry-1"]),
    ).rejects.toThrow(/Destination list not found/u);
  });

  it("moves across intents, inserting in the destination kind", async () => {
    const source = buildList({ id: "list-a", kind: "card", intent: "wish" });
    const destination = buildList({ id: "list-b", kind: "card", intent: "trade" });
    const entries = [buildEntry({ id: "entry-1", kind: "card", cardId: "card-1", quantity: 3 })];
    const { repos, bulkCreateEntries } = createMockRepos({ source, destination, entries });

    const result = await moveListEntries(repos, mockTransact(repos), "user-1", "list-a", "list-b", [
      "entry-1",
    ]);

    expect(result).toEqual({ moved: 1, merged: 0 });
    const [kind, values] = firstInsert(bulkCreateEntries);
    expect(kind).toBe("card");
    expect(values).toEqual([expect.objectContaining({ cardId: "card-1", quantity: 3 })]);
  });

  it("copy mode inserts at the destination and keeps the source entries", async () => {
    const source = buildList({ id: "list-a", kind: "card", intent: "wish" });
    const destination = buildList({ id: "list-b", kind: "card", intent: "organize" });
    const entries = [buildEntry({ id: "entry-1", kind: "card", cardId: "card-1", quantity: 2 })];
    const { repos, bulkCreateEntries, deleteEntriesByIds } = createMockRepos({
      source,
      destination,
      entries,
    });

    const result = await moveListEntries(
      repos,
      mockTransact(repos),
      "user-1",
      "list-a",
      "list-b",
      ["entry-1"],
      [],
      "copy",
    );

    expect(result).toEqual({ moved: 1, merged: 0 });
    expect(bulkCreateEntries).toHaveBeenCalledTimes(1);
    expect(deleteEntriesByIds).not.toHaveBeenCalled();
  });

  it("narrows a copy entry to its printing, and a printing entry to its card", async () => {
    const source = buildList({ id: "list-a", kind: "copy", intent: "organize" });
    const destination = buildList({ id: "list-b", kind: "printing", intent: "organize" });
    const entries = [
      buildEntry({ id: "entry-1", kind: "copy", copyId: "copy-1", resolvedPrintingId: "p-1" }),
    ];
    const { repos, bulkCreateEntries } = createMockRepos({ source, destination, entries });
    await moveListEntries(repos, mockTransact(repos), "user-1", "list-a", "list-b", ["entry-1"]);
    const [kind, values] = firstInsert(bulkCreateEntries);
    expect(kind).toBe("printing");
    expect(values).toEqual([
      expect.objectContaining({ kind: "printing", printingId: "p-1", copyId: null, quantity: 1 }),
    ]);

    const cardDestination = buildList({ id: "list-c", kind: "card", intent: "organize" });
    const printingSource = buildList({ id: "list-p", kind: "printing", intent: "organize" });
    const second = createMockRepos({
      source: printingSource,
      destination: cardDestination,
      entries: [
        buildEntry({
          id: "entry-2",
          kind: "printing",
          printingId: "p-2",
          resolvedCardId: "card-2",
          quantity: 4,
        }),
      ],
    });
    await moveListEntries(second.repos, mockTransact(second.repos), "user-1", "list-p", "list-c", [
      "entry-2",
    ]);
    expect(firstInsert(second.bulkCreateEntries)[1]).toEqual([
      expect.objectContaining({ kind: "card", cardId: "card-2", printingId: null, quantity: 4 }),
    ]);
  });

  it("rejects group-shared copies moving onto a wish or trade list", async () => {
    const source = buildList({ id: "list-a", kind: "copy", intent: "organize" });
    const destination = buildList({ id: "list-b", kind: "printing", intent: "trade" });
    const entries = [
      buildEntry({ id: "entry-1", kind: "copy", copyId: "copy-1", resolvedPrintingId: "p-1" }),
    ];
    const { repos, ownedCopyTargets } = createMockRepos({
      source,
      destination,
      entries,
      ownedCopies: [],
    });
    await expect(
      moveListEntries(repos, mockTransact(repos), "user-1", "list-a", "list-b", ["entry-1"]),
    ).rejects.toThrow(/Group-shared/u);
    expect(ownedCopyTargets).toHaveBeenCalledWith("user-1", ["copy-1"], true);
  });

  it("widens a card entry to the picked printing of that card", async () => {
    const source = buildList({ id: "list-a", kind: "card", intent: "wish" });
    const destination = buildList({ id: "list-b", kind: "printing", intent: "wish" });
    const entries = [buildEntry({ id: "entry-1", kind: "card", cardId: "card-1", quantity: 2 })];
    const { repos, bulkCreateEntries } = createMockRepos({
      source,
      destination,
      entries,
      printings: [{ id: "p-1", cardId: "card-1" }],
    });

    await moveListEntries(
      repos,
      mockTransact(repos),
      "user-1",
      "list-a",
      "list-b",
      ["entry-1"],
      [{ entryId: "entry-1", printingId: "p-1" }],
    );

    expect(firstInsert(bulkCreateEntries)[1]).toEqual([
      expect.objectContaining({ kind: "printing", printingId: "p-1", quantity: 2 }),
    ]);
  });

  it("rejects a widening to printing without a pick or with a foreign printing", async () => {
    const source = buildList({ id: "list-a", kind: "card", intent: "wish" });
    const destination = buildList({ id: "list-b", kind: "printing", intent: "wish" });
    const entries = [buildEntry({ id: "entry-1", kind: "card", cardId: "card-1" })];
    const { repos } = createMockRepos({
      source,
      destination,
      entries,
      printings: [{ id: "p-other", cardId: "card-2" }],
    });

    await expect(
      moveListEntries(repos, mockTransact(repos), "user-1", "list-a", "list-b", ["entry-1"]),
    ).rejects.toThrow(/Pick the printing/u);
    await expect(
      moveListEntries(
        repos,
        mockTransact(repos),
        "user-1",
        "list-a",
        "list-b",
        ["entry-1"],
        [{ entryId: "entry-1", printingId: "p-other" }],
      ),
    ).rejects.toThrow(/belong to the entry's card/u);
  });

  it("widens a printing entry to the picked owned copies, one row each", async () => {
    const source = buildList({ id: "list-a", kind: "printing", intent: "trade" });
    const destination = buildList({ id: "list-b", kind: "copy", intent: "trade" });
    const entries = [
      buildEntry({ id: "entry-1", kind: "printing", printingId: "p-1", quantity: 2 }),
    ];
    const { repos, bulkCreateEntries, ownedCopyTargets } = createMockRepos({
      source,
      destination,
      entries,
      ownedCopies: [
        { copyId: "copy-1", printingId: "p-1", cardId: "card-1" },
        { copyId: "copy-2", printingId: "p-1", cardId: "card-1" },
      ],
    });

    await moveListEntries(
      repos,
      mockTransact(repos),
      "user-1",
      "list-a",
      "list-b",
      ["entry-1"],
      [{ entryId: "entry-1", copyIds: ["copy-1", "copy-2"] }],
    );

    expect(ownedCopyTargets).toHaveBeenCalledWith("user-1", ["copy-1", "copy-2"], true);
    const [kind, values] = firstInsert(bulkCreateEntries);
    expect(kind).toBe("copy");
    expect(values).toEqual([
      expect.objectContaining({ kind: "copy", copyId: "copy-1", quantity: 1 }),
      expect.objectContaining({ kind: "copy", copyId: "copy-2", quantity: 1 }),
    ]);
  });

  it("rejects picked copies that are not owned or belong to another printing", async () => {
    const source = buildList({ id: "list-a", kind: "printing", intent: "organize" });
    const destination = buildList({ id: "list-b", kind: "copy", intent: "organize" });
    const entries = [buildEntry({ id: "entry-1", kind: "printing", printingId: "p-1" })];
    const { repos } = createMockRepos({
      source,
      destination,
      entries,
      ownedCopies: [{ copyId: "copy-2", printingId: "p-2", cardId: "card-1" }],
    });

    await expect(
      moveListEntries(
        repos,
        mockTransact(repos),
        "user-1",
        "list-a",
        "list-b",
        ["entry-1"],
        [{ entryId: "entry-1", copyIds: ["copy-2"] }],
      ),
    ).rejects.toThrow(/match the entry/u);
  });

  it("returns zero counts and skips the destination write when no matching entries are found", async () => {
    const source = buildList({ id: "list-a", kind: "card", intent: "wish" });
    const destination = buildList({ id: "list-b", kind: "card", intent: "wish" });
    const { repos, bulkCreateEntries, deleteEntriesByIds } = createMockRepos({
      source,
      destination,
      entries: [],
    });

    const result = await moveListEntries(repos, mockTransact(repos), "user-1", "list-a", "list-b", [
      "entry-stale",
    ]);

    expect(result).toEqual({ moved: 0, merged: 0 });
    expect(bulkCreateEntries).not.toHaveBeenCalled();
    expect(deleteEntriesByIds).not.toHaveBeenCalled();
  });

  it("moves entries: forwards card/printing/copy targets, reports merged for upserts", async () => {
    const source = buildList({ id: "list-a", kind: "card", intent: "wish" });
    const destination = buildList({ id: "list-b", kind: "card", intent: "wish" });
    const entries = [
      buildEntry({ id: "entry-1", kind: "card", cardId: "card-1", quantity: 2 }),
      buildEntry({ id: "entry-2", kind: "card", cardId: "card-2", quantity: 1 }),
    ];
    const { repos, bulkCreateEntries, deleteEntriesByIds } = createMockRepos({
      source,
      destination,
      entries,
      bulkResult: { inserted: 1, updated: 1 },
      deleteCount: 2,
    });

    const result = await moveListEntries(repos, mockTransact(repos), "user-1", "list-a", "list-b", [
      "entry-1",
      "entry-2",
    ]);

    expect(result).toEqual({ moved: 2, merged: 1 });
    expect(bulkCreateEntries).toHaveBeenCalledTimes(1);
    const [kindArg, valuesArg] = bulkCreateEntries.mock.calls[0]!;
    expect(kindArg).toBe("card");
    expect(valuesArg).toEqual([
      expect.objectContaining({
        listId: "list-b",
        userId: "user-1",
        kind: "card",
        cardId: "card-1",
        printingId: null,
        copyId: null,
        quantity: 2,
      }),
      expect.objectContaining({
        listId: "list-b",
        cardId: "card-2",
        quantity: 1,
      }),
    ]);
    expect(deleteEntriesByIds).toHaveBeenCalledWith(["entry-1", "entry-2"], "list-a", "user-1");
  });

  it("preserves the source entry's tradeOverride on the destination insert", async () => {
    const source = buildList({ id: "list-a", kind: "printing", intent: "trade" });
    const destination = buildList({ id: "list-b", kind: "printing", intent: "trade" });
    const entries = [
      buildEntry({
        id: "entry-1",
        kind: "printing",
        printingId: "printing-1",
        quantity: 1,
        pricePref: "absolute",
        priceAbsoluteCents: 1500,
        tradeType: "money",
      }),
    ];
    const { repos, bulkCreateEntries } = createMockRepos({
      source,
      destination,
      entries,
      bulkResult: { inserted: 1, updated: 0 },
      deleteCount: 1,
    });

    await moveListEntries(repos, mockTransact(repos), "user-1", "list-a", "list-b", ["entry-1"]);

    const [, valuesArg] = bulkCreateEntries.mock.calls[0]!;
    expect(valuesArg[0]).toEqual(
      expect.objectContaining({
        pricePref: "absolute",
        priceAbsoluteCents: 1500,
        tradeType: "money",
      }),
    );
  });
});
