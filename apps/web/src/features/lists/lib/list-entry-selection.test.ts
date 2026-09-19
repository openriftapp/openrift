import type { ListEntryDetailResponse } from "@openrift/shared/types/api/list";
import type { Printing } from "@openrift/shared/types/catalog";
import { describe, expect, it } from "vitest";

import { EMPTY_TRADE_PREFERENCE, stubPrinting } from "@/test/factories";

import {
  hasRuleSelection,
  listSelectionSubjects,
  orderedSelectedEntryIds,
  selectionDragFields,
  splitSelectionParts,
} from "./list-entry-selection";

const entryBase = {
  listId: "list-1",
  tradeOverride: EMPTY_TRADE_PREFERENCE,
  source: "manual" as const,
  ruleQuantity: 0,
};

const printingFields = {
  setId: "set-1",
  rarity: "common",
  finish: "normal",
  shortCode: "RB1-001",
  language: "EN",
  imageId: null,
};

function printingEntry(
  id: string | null,
  printingId: string,
  cardName: string,
  quantity: number,
): ListEntryDetailResponse {
  return { ...entryBase, id, kind: "printing", printingId, cardName, quantity, ...printingFields };
}

function copyEntry(id: string | null, copyId: string): ListEntryDetailResponse {
  return {
    ...entryBase,
    id,
    kind: "copy",
    copyId,
    printingId: "pa",
    cardName: "Chaos Rune",
    quantity: 1,
    ...printingFields,
    reserved: false,
    onLoan: false,
  };
}

const printingA = stubPrinting({ id: "pa" });
const printingB = stubPrinting({ id: "pb" });

const manual = printingEntry("e1", "pa", "Chaos Rune", 2);
const ruleDerived = printingEntry(null, "pb", "Ionian Blade", 3);
const entryByItemId = new Map([
  ["i1", manual],
  ["i2", ruleDerived],
]);
const printingByEntryId = new Map<string, Printing>([
  ["e1", printingA],
  ["rule:i2", printingB],
]);

describe("orderedSelectedEntryIds", () => {
  it("returns selected ids in grid order, rule entries included", () => {
    const selected = new Set(["rule:i2", "e1"]);
    expect(orderedSelectedEntryIds(selected, entryByItemId)).toEqual(["e1", "rule:i2"]);
  });

  it("ignores ids that no longer have a tile", () => {
    expect(orderedSelectedEntryIds(new Set(["gone"]), entryByItemId)).toEqual([]);
  });
});

describe("hasRuleSelection", () => {
  it("spots a rule entry in the selection", () => {
    expect(hasRuleSelection(["e1", "rule:i2"])).toBe(true);
    expect(hasRuleSelection(["e1"])).toBe(false);
  });
});

describe("splitSelectionParts", () => {
  it("separates rows the API can move from rule entries it must re-add", () => {
    const parts = splitSelectionParts(["e1", "rule:i2"], entryByItemId, printingByEntryId);
    expect(parts.entryIds).toEqual(["e1"]);
    expect(parts.ruleSubjects).toEqual([
      {
        ruleEntry: { kind: "printing", printingId: "pb" },
        printing: printingB,
        totalQuantity: 3,
        cardName: "Ionian Blade",
      },
    ]);
  });

  it("drops a rule entry whose tile is no longer on screen", () => {
    const parts = splitSelectionParts(["rule:i2"], entryByItemId, new Map());
    expect(parts.ruleSubjects).toEqual([]);
  });
});

describe("listSelectionSubjects", () => {
  it("carries each entry's own quantity and displayed printing", () => {
    expect(
      listSelectionSubjects(["e1", "rule:i2"], "printing", entryByItemId, printingByEntryId),
    ).toEqual([
      { sourceKind: "printing", totalQuantity: 2, printing: printingA, cardName: "Chaos Rune" },
      { sourceKind: "printing", totalQuantity: 3, printing: printingB, cardName: "Ionian Blade" },
    ]);
  });
});

describe("selectionDragFields", () => {
  it("keeps only movable rows and sums the selected quantities", () => {
    const fields = selectionDragFields(["e1", "rule:i2"], entryByItemId, printingByEntryId);
    expect(fields.entryIds).toEqual(["e1"]);
    expect(fields.totalQuantity).toBe(5);
    expect(fields.previewPrintings).toEqual([printingA, printingB]);
  });

  it("collects the copy ids of selected copy entries", () => {
    const copies = new Map([
      ["i1", copyEntry("e1", "copy-1")],
      ["i2", copyEntry(null, "copy-2")],
    ]);
    expect(selectionDragFields(["e1", "rule:i2"], copies, printingByEntryId).copyIds).toEqual([
      "copy-1",
      "copy-2",
    ]);
  });
});
