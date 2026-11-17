import { describe, expect, it } from "vitest";

import { bulkAddItemMatches, listEntryWritePending } from "./list-entry-writes";

const NONE = { adds: [], entryWrites: [] };

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
