import { EMPTY_PRICE_LOOKUP } from "@openrift/shared/price-lookup";
import { MAX_LIST_ENTRY_QUANTITY } from "@openrift/shared/schemas";
import { makePrinting } from "@openrift/shared/test-factories";
import type { Printing } from "@openrift/shared/types/catalog";
import { EMPTY_CARD_FILTERS } from "@openrift/shared/types/search";
import type { Kysely } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../db/tables.js";
import { createMockDb } from "../../../test/mock-db.js";
import { createRecordingDb } from "../../../test/recording-db.js";
import type { ListRuleProviders } from "./lists-rules.js";
import { listsRepo } from "./lists.js";

const LIST = {
  id: "lst-1",
  userId: "u1",
  name: "Wants",
  intent: "wish" as const,
  kind: "card" as const,
  isPublic: false,
  shareToken: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("listsRepo", () => {
  it("update leaves the rules version alone when the rules are not written", async () => {
    const recording = createRecordingDb([[{ id: "lst-1" }]]);
    await listsRepo(recording.db).update("lst-1", "u1", { name: "Renamed" });

    expect(recording.queries[0]).not.toMatch(/rules_version/u);
  });

  it("update bumps the rules version and checks the expected one in the same statement", async () => {
    const recording = createRecordingDb([[{ id: "lst-1" }]]);
    await listsRepo(recording.db).update("lst-1", "u1", { ruleCombine: "max" }, 4);

    expect(recording.queries).toHaveLength(1);
    expect(recording.queries[0]).toMatch(
      /^update "lists" set "rule_combine" = \$1, "rules_version" = rules_version \+ 1 where .* and "rules_version" = \$4 returning/u,
    );
    expect(recording.parameters[0]?.at(-1)).toBe(4);
  });

  it("update answers stale when the list exists at another rules version", async () => {
    const recording = createRecordingDb([[], [{ id: "lst-1" }]]);
    const result = await listsRepo(recording.db).update("lst-1", "u1", { rules: [] }, 4);

    expect(result).toEqual({ outcome: "stale" });
  });

  it("update answers missing when the list is gone", async () => {
    const recording = createRecordingDb([[], []]);
    const result = await listsRepo(recording.db).update("lst-1", "u1", { rules: [] }, 4);

    expect(result).toEqual({ outcome: "missing" });
  });

  it("deleteByIdForUser reports whether a row was deleted", async () => {
    await expect(
      listsRepo(createMockDb({ numDeletedRows: 1n })).deleteByIdForUser("lst-1", "u1"),
    ).resolves.toBe(true);
    await expect(
      listsRepo(createMockDb({ numDeletedRows: 0n })).deleteByIdForUser("lst-1", "u1"),
    ).resolves.toBe(false);
  });

  it("listMembershipsForCopies short-circuits on empty input without hitting the db", async () => {
    const db = createMockDb([{ listId: "should-not-appear", listName: "x", copyId: "c" }]);
    const repo = listsRepo(db);
    expect(await repo.listMembershipsForCopies([], "u1")).toEqual({
      lists: [],
      copiesOnAnyList: 0,
    });
  });

  it("listMembershipsForCopies counts distinct copies per list and overall, busiest first", async () => {
    // copy-1 sits on both lists; copy-2 only on Trades. Distinct counting must
    // not double-count copy-1 across lists, and copiesOnAnyList is the union.
    const db = createMockDb([
      { listId: "lst-trades", listName: "Trades", copyId: "copy-1" },
      { listId: "lst-trades", listName: "Trades", copyId: "copy-2" },
      { listId: "lst-binder", listName: "Binder", copyId: "copy-1" },
    ]);
    const repo = listsRepo(db);
    expect(await repo.listMembershipsForCopies(["copy-1", "copy-2"], "u1")).toEqual({
      lists: [
        { id: "lst-trades", name: "Trades", copyCount: 2 },
        { id: "lst-binder", name: "Binder", copyCount: 1 },
      ],
      copiesOnAnyList: 2,
    });
  });

  it("listMembershipsForCopies returns empty when no list references the copies", async () => {
    const db = createMockDb([]);
    const repo = listsRepo(db);
    expect(await repo.listMembershipsForCopies(["copy-1"], "u1")).toEqual({
      lists: [],
      copiesOnAnyList: 0,
    });
  });

  it("getByShareToken returns list + owner name", async () => {
    const db = createMockDb([{ ...LIST, ownerName: "Friend" }]);
    const repo = listsRepo(db);
    const found = await repo.getByShareToken("tok-abc");
    expect(found?.list.id).toBe("lst-1");
    expect(found?.ownerName).toBe("Friend");
  });

  it("bulkCreateEntries counts inserted vs. updated rows from the xmax marker", async () => {
    // The .returning(xmax = 0) marker distinguishes brand-new rows (true)
    // from rows merged into via ON CONFLICT DO UPDATE (false).
    const db = createMockDb([{ inserted: true }, { inserted: false }, { inserted: true }]);
    const repo = listsRepo(db);
    const result = await repo.bulkCreateEntries("card", [
      {
        listId: "lst-1",
        userId: "u1",
        kind: "card",
        cardId: "card-1",
        printingId: null,
        copyId: null,
        quantity: 1,
      },
      {
        listId: "lst-1",
        userId: "u1",
        kind: "card",
        cardId: "card-2",
        printingId: null,
        copyId: null,
        quantity: 1,
      },
      {
        listId: "lst-1",
        userId: "u1",
        kind: "card",
        cardId: "card-3",
        printingId: null,
        copyId: null,
        quantity: 1,
      },
    ]);
    expect(result).toEqual({ inserted: 2, updated: 1 });
  });

  it("bulkCreateEntriesFromCopies returns zero counts for empty input", async () => {
    const db = createMockDb([{ id: "should-not-appear" }]);
    const repo = listsRepo(db);
    expect(await repo.bulkCreateEntriesFromCopies("lst-1", "card", "u1", [], false)).toEqual({
      added: 0,
      updated: 0,
      skipped: 0,
    });
  });

  it("bulkCreateEntriesFromCopies files a double-sided copy under the dragged tile's card", async () => {
    const repo = listsRepo(createMockDb([]));
    repo.ownedCopyTargets = vi.fn(async () => [
      { copyId: "c1", printingId: "pair", cardId: "bird", cardIds: ["bird", "gold"] },
    ]) as never;
    const bulkCreateEntries = vi.fn(async () => ({ inserted: 1, updated: 0 }));
    repo.bulkCreateEntries = bulkCreateEntries as never;

    await repo.bulkCreateEntriesFromCopies("lst-1", "card", "u1", ["c1"], false, "gold");

    expect(bulkCreateEntries).toHaveBeenCalledWith("card", [
      expect.objectContaining({ cardId: "gold" }),
    ]);
  });

  it("removeCollectionFromRules locks the rule rows it rewrites", async () => {
    const recording = createRecordingDb([
      [{ id: "lst-1", rules: [{ kind: "trade", collectionIds: ["col-1", "col-2"] }] }],
    ]);
    await listsRepo(recording.db).removeCollectionFromRules("u1", "col-1");

    expect(recording.queries[0]).toMatch(
      /^select .* from "lists" .* order by "id" for no key update$/u,
    );
    expect(recording.queries[1]).toMatch(
      /^update "lists" set "rules" = \$1, "rules_version" = rules_version \+ 1 /u,
    );
  });

  it("updateEntry steps the stored quantity in one statement, between 1 and the entry maximum", async () => {
    const recording = createRecordingDb([[{ id: "le-1" }]]);
    await listsRepo(recording.db).updateEntry("le-1", "lst-1", "u1", {}, -1);

    expect(recording.queries).toHaveLength(1);
    expect(recording.queries[0]).toMatch(
      /^update "list_entries" set "quantity" = case when kind = 'copy' then quantity else least\(greatest\(quantity \+ \$1, 1\), \$2\) end where/u,
    );
    expect(recording.parameters[0]?.slice(0, 2)).toEqual([-1, MAX_LIST_ENTRY_QUANTITY]);
  });
});

/**
 * Fake `db` that answers by table, so the two queries `expandedCounts` makes
 * (`lists`, then `listEntries`) get their own canned rows. WHERE clauses are
 * ignored — the canned rows already stand for the filtered result.
 */
function tableDb(rowsByTable: Record<string, Record<string, unknown>[]>): Kysely<Database> {
  function chain(table: string): unknown {
    const handler: ProxyHandler<() => unknown> = {
      get(_target, prop) {
        if (prop === "execute") {
          return () => Promise.resolve(rowsByTable[table] ?? []);
        }
        if (prop === "then" || prop === "catch" || prop === "finally" || typeof prop === "symbol") {
          return undefined;
        }
        return () => chain(table);
      },
      apply() {
        return chain(table);
      },
    };
    return new Proxy(() => chain(table), handler);
  }
  return {
    selectFrom: (arg: string) => chain(arg.split(" ")[0]!),
  } as unknown as Kysely<Database>;
}

/**
 * Minimal catalog {@link Printing} for `filterCards`; the empty filter matches
 * every one of these.
 */
function catalogPrinting(id: string, cardId: string): Printing {
  return makePrinting({
    printingId: id,
    cardId,
    shortCode: id,
    publicCode: "PUB",
    card: {
      slug: cardId,
      name: `Card ${cardId}`,
      domains: ["fury"],
      energy: 1,
      might: 1,
      power: 1,
      mightBonus: 0,
    },
  });
}

/** A card-kind wish rule that takes the whole catalog, one copy of each. */
const CATCH_ALL_WISH_RULE = {
  kind: "wish" as const,
  filter: EMPTY_CARD_FILTERS,
  quantity: { mode: "fixed" as const, n: 1 },
  excludeIds: [],
  netOwned: false,
};

const CATALOG = [
  catalogPrinting("prt-1", "crd-1"),
  catalogPrinting("prt-2", "crd-2"),
  catalogPrinting("prt-3", "crd-3"),
];

function ruleListRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "lst-rule",
    kind: "card",
    rules: [CATCH_ALL_WISH_RULE],
    ruleCombine: null,
    userId: "u1",
    ...overrides,
  };
}

function manualEntryRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "le-1",
    listId: "lst-rule",
    kind: "card",
    cardId: "crd-1",
    printingId: null,
    copyId: null,
    quantity: 1,
    pricePref: null,
    priceAbsoluteCents: null,
    tradeType: null,
    ...overrides,
  };
}

function countingProviders(catalog: Printing[] = CATALOG) {
  const ownedCopyCalls: string[] = [];
  let catalogCalls = 0;
  let priceCalls = 0;
  let enumCalls = 0;
  const providers: ListRuleProviders = {
    assembleCatalog: () => {
      catalogCalls++;
      return Promise.resolve({ printings: catalog, customTagAssignments: {} });
    },
    ownedCopies: (ownerId) => {
      ownedCopyCalls.push(ownerId);
      return Promise.resolve([]);
    },
    enumOrders: () => {
      enumCalls++;
      return Promise.resolve({ finishes: [], rarities: [], artVariants: [] });
    },
    priceLookup: () => {
      priceCalls++;
      return Promise.resolve(EMPTY_PRICE_LOOKUP);
    },
  };
  return {
    providers,
    ownedCopyCalls,
    counts: () => ({ catalogCalls, priceCalls, enumCalls }),
  };
}

describe("listsRepo.expandedCounts", () => {
  it("counts a rule list's expansion without enriching entries", async () => {
    const { providers } = countingProviders();
    const db = tableDb({ lists: [ruleListRow()], listEntries: [] });
    const counts = await listsRepo(db, providers).expandedCounts(["lst-rule"]);

    // The catch-all rule takes all three catalog cards.
    expect(counts.get("lst-rule")).toBe(3);
  });

  it("merges manual entries with rule output instead of adding them", async () => {
    const { providers } = countingProviders();
    const db = tableDb({
      lists: [ruleListRow()],
      // crd-1 is also produced by the rule (so it must not double-count);
      // crd-9 is outside the catalog, so it only exists manually.
      listEntries: [
        manualEntryRow({ id: "le-1", cardId: "crd-1" }),
        manualEntryRow({ id: "le-2", cardId: "crd-9" }),
      ],
    });
    const counts = await listsRepo(db, providers).expandedCounts(["lst-rule"]);

    // 3 from the rule + the manual-only crd-9; crd-1 is one entry, not two.
    expect(counts.get("lst-rule")).toBe(4);
  });

  it("skips lists that carry no rules, so callers keep the materialized count", async () => {
    const { providers } = countingProviders();
    const db = tableDb({
      lists: [ruleListRow(), ruleListRow({ id: "lst-manual", rules: [] })],
      listEntries: [],
    });
    const counts = await listsRepo(db, providers).expandedCounts(["lst-rule", "lst-manual"]);

    expect(counts.has("lst-rule")).toBe(true);
    expect(counts.has("lst-manual")).toBe(false);
  });

  it("loads owned copies once per owner, not once per list", async () => {
    const tradeRule = {
      kind: "trade" as const,
      filter: EMPTY_CARD_FILTERS,
      keepPerCard: { mode: "fixed" as const, n: 0 },
      collectionIds: null,
      keepCopyIds: [],
    };
    const { providers, ownedCopyCalls } = countingProviders();
    const db = tableDb({
      lists: [
        ruleListRow({ id: "a", kind: "copy", userId: "u1", rules: [tradeRule] }),
        ruleListRow({ id: "b", kind: "copy", userId: "u1", rules: [tradeRule] }),
        ruleListRow({ id: "c", kind: "copy", userId: "u2", rules: [tradeRule] }),
      ],
      listEntries: [],
    });
    await listsRepo(db, providers).expandedCounts(["a", "b", "c"]);

    // Three lists, two owners, two inventory reads.
    expect(ownedCopyCalls.toSorted()).toEqual(["u1", "u2"]);
  });

  it("assembles the catalog once for the whole batch", async () => {
    const { providers, counts: callCounts } = countingProviders();
    const db = tableDb({
      lists: [ruleListRow({ id: "a" }), ruleListRow({ id: "b" }), ruleListRow({ id: "c" })],
      listEntries: [],
    });
    await listsRepo(db, providers).expandedCounts(["a", "b", "c"]);

    expect(callCounts().catalogCalls).toBe(1);
  });

  it("skips the price and keep-order loads when no rule needs them", async () => {
    const { providers, counts: callCounts, ownedCopyCalls } = countingProviders();
    const db = tableDb({ lists: [ruleListRow()], listEntries: [] });
    await listsRepo(db, providers).expandedCounts(["lst-rule"]);

    // A plain wish rule reads neither prices, keep orders, nor the inventory.
    expect(callCounts().priceCalls).toBe(0);
    expect(callCounts().enumCalls).toBe(0);
    expect(ownedCopyCalls).toEqual([]);
  });

  it("returns an empty map for no ids, and without providers", async () => {
    const { providers } = countingProviders();
    const db = tableDb({ lists: [ruleListRow()], listEntries: [] });

    const noIds = await listsRepo(db, providers).expandedCounts([]);
    expect(noIds.size).toBe(0);
    // No providers wired (a repo built for a manual-only path) must not throw.
    const noProviders = await listsRepo(db).expandedCounts(["lst-rule"]);
    expect(noProviders.size).toBe(0);
  });

  it("returns an empty map when the ids match no list", async () => {
    const { providers } = countingProviders();
    const db = tableDb({ lists: [], listEntries: [] });

    const counts = await listsRepo(db, providers).expandedCounts(["ghost"]);
    expect(counts.size).toBe(0);
  });
});

describe("listsRepo.ruleMatchContext", () => {
  it("loads nothing for a copy list, whose pins match no catalog", async () => {
    const { providers, counts } = countingProviders();
    const ctx = await listsRepo(createMockDb([]), providers).ruleMatchContext("copy", [
      CATCH_ALL_WISH_RULE,
    ]);
    expect(ctx.catalog).toEqual([]);
    expect(counts()).toEqual({ catalogCalls: 0, priceCalls: 0, enumCalls: 0 });
  });

  it("loads prices only when a rule filters on price", async () => {
    const { providers, counts } = countingProviders();
    const repo = listsRepo(createMockDb([]), providers);
    const plain = await repo.ruleMatchContext("card", [CATCH_ALL_WISH_RULE]);
    expect(plain.catalog).toBe(CATALOG);
    expect(plain.priceLookup).toBeUndefined();
    await repo.ruleMatchContext("card", [
      {
        ...CATCH_ALL_WISH_RULE,
        filter: { ...EMPTY_CARD_FILTERS, price: { min: 1, max: null } },
        priceMarketplace: "cardtrader",
      },
    ]);
    expect(counts()).toEqual({ catalogCalls: 2, priceCalls: 1, enumCalls: 0 });
  });
});
