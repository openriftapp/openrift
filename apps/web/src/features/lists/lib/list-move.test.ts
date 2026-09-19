import type { Printing } from "@openrift/shared/types/catalog";
import { describe, expect, it } from "vitest";

import { entryAddsCopies, moveNeedsDialog, movePickFor, ruleEntryCopyInputs } from "./list-move";

describe("movePickFor", () => {
  it("needs nothing for same or narrower kinds", () => {
    expect(movePickFor("copy", "copy")).toBe("none");
    expect(movePickFor("copy", "printing")).toBe("none");
    expect(movePickFor("printing", "card")).toBe("none");
  });

  it("needs a printing for card → printing and copies for anything → copy", () => {
    expect(movePickFor("card", "printing")).toBe("printing");
    expect(movePickFor("card", "copy")).toBe("copies");
    expect(movePickFor("printing", "copy")).toBe("copies");
  });
});

describe("moveNeedsDialog", () => {
  it("is false only for the same intent and a same-or-narrower kind", () => {
    expect(
      moveNeedsDialog({ kind: "copy", intent: "wish" }, { kind: "card", intent: "wish" }),
    ).toBe(false);
    expect(
      moveNeedsDialog({ kind: "card", intent: "wish" }, { kind: "card", intent: "trade" }),
    ).toBe(true);
    expect(
      moveNeedsDialog({ kind: "card", intent: "wish" }, { kind: "printing", intent: "wish" }),
    ).toBe(true);
  });
});

describe("ruleEntryCopyInputs", () => {
  const printing = { cardId: "card-1" } as Printing;
  const base = { printing, totalQuantity: 3 };

  it("copies onto a card list by card id with the full quantity", () => {
    expect(
      ruleEntryCopyInputs(
        { ...base, ruleEntry: { kind: "printing", printingId: "p1" } },
        "card",
        null,
      ),
    ).toEqual([{ cardId: "card-1", quantity: 3 }]);
  });

  it("keeps the entry's own printing or copy when the target kind is not wider", () => {
    expect(
      ruleEntryCopyInputs(
        { ...base, ruleEntry: { kind: "printing", printingId: "p1" } },
        "printing",
        null,
      ),
    ).toEqual([{ printingId: "p1", quantity: 3 }]);
    expect(
      ruleEntryCopyInputs(
        { ...base, ruleEntry: { kind: "copy", printingId: "p1", copyId: "c1" } },
        "copy",
        { copyIds: ["ignored"] },
      ),
    ).toEqual([{ copyId: "c1" }]);
  });

  it("takes the picked printing or copies when widening", () => {
    expect(
      ruleEntryCopyInputs({ ...base, ruleEntry: { kind: "card" } }, "printing", {
        printingId: "p2",
      }),
    ).toEqual([{ printingId: "p2", quantity: 3 }]);
    expect(
      ruleEntryCopyInputs({ ...base, ruleEntry: { kind: "card" } }, "copy", {
        copyIds: ["c1", "c2"],
      }),
    ).toEqual([{ copyId: "c1" }, { copyId: "c2" }]);
  });

  it("yields nothing when a widening copy has no pick", () => {
    expect(ruleEntryCopyInputs({ ...base, ruleEntry: { kind: "card" } }, "printing", null)).toEqual(
      [],
    );
    expect(ruleEntryCopyInputs({ ...base, ruleEntry: { kind: "card" } }, "copy", null)).toEqual([]);
  });
});

describe("entryAddsCopies", () => {
  it("allows entries that track cards or printings", () => {
    expect(entryAddsCopies("card")).toBe(true);
    expect(entryAddsCopies("printing")).toBe(true);
  });

  it("rejects copy entries, which already point at copies you own", () => {
    expect(entryAddsCopies("copy")).toBe(false);
  });
});
