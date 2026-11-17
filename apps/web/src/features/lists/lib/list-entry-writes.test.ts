import { describe, expect, it } from "vitest";

import {
  bulkAddItemMatches,
  listEntryWritePending,
  manualQuantity,
  totalQuantity,
} from "./list-entry-writes";

const NONE = { adds: [], entryWrites: [] };

describe("manualQuantity and totalQuantity", () => {
  it("leaves the rules' part out of a card or printing entry and adds it back", () => {
    const entry = { kind: "card" as const, id: "le-1", quantity: 5, ruleQuantity: 2 };

    expect(manualQuantity(entry)).toBe(3);
    expect(totalQuantity(entry, 2)).toBe(4);
  });

  it("takes a copy entry's quantity as its own, since rules do not add to it", () => {
    const entry = { kind: "copy" as const, id: "le-1", quantity: 1, ruleQuantity: 1 };

    expect(manualQuantity(entry)).toBe(1);
    expect(totalQuantity(entry, 1)).toBe(1);
  });

  it("has no manual quantity on a rule-only entry", () => {
    expect(manualQuantity({ kind: "card", id: null, quantity: 2, ruleQuantity: 2 })).toBe(0);
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

  it("is true for an add that bumps the entry", () => {
    const writes = {
      adds: [{ listId: "lst-1", entries: [{ printingId: "p9" }, { printingId: "p1" }] }],
      entryWrites: [],
    };
    expect(listEntryWritePending("lst-1", entry, writes)).toBe(true);
    expect(listEntryWritePending("lst-1", { ...entry, printingId: "p2" }, writes)).toBe(false);
  });
});
