import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  bulkAddItemMatches,
  entryStepsSettled,
  LIST_ENTRY_MUTATION_KEYS,
  listEntryWritePending,
  listEntryWritesInFlight,
  manualQuantity,
  steppedManualQuantity,
  entryTotalQuantity,
} from "./list-entry-writes";

const NONE = { adds: [], entryWrites: [] };

describe("manualQuantity and entryTotalQuantity", () => {
  it("leaves the rules' part out of a card or printing entry and adds it back", () => {
    const entry = { kind: "card" as const, id: "le-1", quantity: 5, ruleQuantity: 2 };

    expect(manualQuantity(entry)).toBe(3);
    expect(entryTotalQuantity(entry, 2)).toBe(4);
  });

  it("takes a copy entry's quantity as its own, since rules do not add to it", () => {
    const entry = { kind: "copy" as const, id: "le-1", quantity: 1, ruleQuantity: 1 };

    expect(manualQuantity(entry)).toBe(1);
    expect(entryTotalQuantity(entry, 1)).toBe(1);
  });

  it("has no manual quantity on a rule-only entry", () => {
    expect(manualQuantity({ kind: "card", id: null, quantity: 2, ruleQuantity: 2 })).toBe(0);
  });
});

describe("steppedManualQuantity", () => {
  it("steps the manual part and stops at 1", () => {
    const entry = { kind: "card" as const, id: "le-1", quantity: 5, ruleQuantity: 2 };

    expect(steppedManualQuantity(entry, 1)).toBe(4);
    expect(steppedManualQuantity(entry, -5)).toBe(1);
  });

  it("keeps a copy entry at its own quantity", () => {
    expect(
      steppedManualQuantity({ kind: "copy", id: "le-1", quantity: 1, ruleQuantity: 0 }, 1),
    ).toBe(1);
  });
});

describe("bulkAddItemMatches", () => {
  it("matches an add to the entry of the same kind and id", () => {
    expect(bulkAddItemMatches({ cardId: "c1" }, { kind: "card", cardId: "c1" })).toBe(true);
    expect(bulkAddItemMatches({ printingId: "p1" }, { kind: "printing", printingId: "p1" })).toBe(
      true,
    );
    expect(bulkAddItemMatches({ copyId: "x1" }, { kind: "copy", copyId: "x1" })).toBe(true);
  });

  it("does not match across kinds or ids", () => {
    expect(bulkAddItemMatches({ cardId: "c1" }, { kind: "card", cardId: "c2" })).toBe(false);
    expect(bulkAddItemMatches({ cardId: "c1" }, { kind: "printing", printingId: "c1" })).toBe(
      false,
    );
  });
});

describe("listEntryWritePending", () => {
  const entry = { id: "le-1", kind: "printing" as const, printingId: "p1" };

  it("is false with nothing in flight", () => {
    expect(listEntryWritePending("lst-1", entry, NONE)).toBe(false);
  });

  it("is true for an update or remove of the entry on this list only", () => {
    const writes = { adds: [], entryWrites: [{ listId: "lst-1", entryId: "le-1" }] };
    expect(listEntryWritePending("lst-1", entry, writes)).toBe(true);
    expect(listEntryWritePending("lst-2", entry, writes)).toBe(false);
  });

  it("leaves steps out only when asked to", () => {
    const writes = {
      adds: [],
      entryWrites: [{ listId: "lst-1", entryId: "le-1", quantityDelta: 1 }],
    };
    expect(listEntryWritePending("lst-1", entry, writes)).toBe(true);
    expect(listEntryWritePending("lst-1", entry, writes, { countSteps: false })).toBe(false);
  });

  it("is true for an add that bumps the entry", () => {
    const writes = {
      adds: [{ listId: "lst-1", entries: [{ printingId: "p9" }, { printingId: "p1" }] }],
      entryWrites: [],
    };
    expect(listEntryWritePending("lst-1", entry, writes)).toBe(true);
    expect(listEntryWritePending("lst-1", { ...entry, printingId: "p2" }, writes)).toBe(false);
  });
});

describe("listEntryWritesInFlight", () => {
  function start(queryClient: QueryClient, mutationKey: readonly string[], variables: unknown) {
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationKey: [...mutationKey],
      mutationFn: () => new Promise(() => {}),
    });
    void mutation.execute(variables);
  }

  it("counts adds, updates and removes on the list, and nothing else", async () => {
    const queryClient = new QueryClient();
    start(queryClient, LIST_ENTRY_MUTATION_KEYS.add, { listId: "lst-1", entries: [] });
    start(queryClient, LIST_ENTRY_MUTATION_KEYS.update, { listId: "lst-1", entryId: "le-1" });
    start(queryClient, LIST_ENTRY_MUTATION_KEYS.remove, { listId: "lst-1", entryId: "le-2" });
    start(queryClient, LIST_ENTRY_MUTATION_KEYS.update, { listId: "lst-2", entryId: "le-3" });
    start(queryClient, ["lists", "reorder"], { listId: "lst-1" });
    await Promise.resolve();

    expect(listEntryWritesInFlight(queryClient.getMutationCache(), "lst-1")).toBe(3);
    expect(listEntryWritesInFlight(queryClient.getMutationCache(), "lst-3")).toBe(0);
  });
});

describe("entryStepsSettled", () => {
  function start(queryClient: QueryClient, mutationKey: readonly string[], variables: unknown) {
    let finish: () => void = () => {};
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationKey: [...mutationKey],
      mutationFn: () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    });
    const done = mutation.execute(variables);
    return async () => {
      finish();
      await done;
    };
  }

  function watch(promise: Promise<void>) {
    const state = { settled: false };
    const markSettled = async () => {
      await promise;
      state.settled = true;
    };
    void markSettled();
    return state;
  }

  it("resolves at once with no step on the entry in flight", async () => {
    const queryClient = new QueryClient();
    start(queryClient, LIST_ENTRY_MUTATION_KEYS.update, {
      listId: "lst-1",
      entryId: "le-2",
      quantityDelta: 1,
    });
    start(queryClient, LIST_ENTRY_MUTATION_KEYS.update, {
      listId: "lst-1",
      entryId: "le-1",
      tradeOverride: {},
    });
    await Promise.resolve();

    await expect(
      entryStepsSettled(queryClient.getMutationCache(), "lst-1", "le-1"),
    ).resolves.toBeUndefined();
  });

  it("waits for every step on the entry to settle", async () => {
    const queryClient = new QueryClient();
    const step = { listId: "lst-1", entryId: "le-1", quantityDelta: -1 };
    const finishFirst = start(queryClient, LIST_ENTRY_MUTATION_KEYS.update, step);
    const finishSecond = start(queryClient, LIST_ENTRY_MUTATION_KEYS.update, step);
    await Promise.resolve();

    const waiting = watch(entryStepsSettled(queryClient.getMutationCache(), "lst-1", "le-1"));
    await finishFirst();
    await Promise.resolve();
    expect(waiting.settled).toBe(false);

    await finishSecond();
    await Promise.resolve();
    expect(waiting.settled).toBe(true);
  });
});
