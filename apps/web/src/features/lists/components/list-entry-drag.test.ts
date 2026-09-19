import type { ListEntryDetailResponse } from "@openrift/shared/types/api/list";
import type { Printing } from "@openrift/shared/types/catalog";
import { describe, expect, it } from "vitest";

import type { ListEntryDragData } from "@/features/collections/components/dnd-types";
import { EMPTY_TRADE_PREFERENCE, stubPrinting } from "@/test/factories";

import { resolveListEntrySelection } from "./list-entry-drag";

const entryBase = {
  listId: "list-1",
  tradeOverride: EMPTY_TRADE_PREFERENCE,
  source: "manual" as const,
  ruleQuantity: 0,
};

function printingEntry(
  id: string | null,
  printingId: string,
  cardName: string,
  quantity: number,
): ListEntryDetailResponse {
  return {
    ...entryBase,
    id,
    kind: "printing",
    printingId,
    cardName,
    quantity,
    setId: "set-1",
    rarity: "common",
    finish: "normal",
    shortCode: "RB1-001",
    language: "EN",
    imageId: null,
  };
}

const printingA = stubPrinting({ id: "pa" });
const printingB = stubPrinting({ id: "pb" });

const entryByItemId = new Map([
  ["i1", printingEntry("e1", "pa", "Chaos Rune", 2)],
  ["i2", printingEntry(null, "pb", "Ionian Blade", 3)],
]);
const printingByEntryId = new Map<string, Printing>([
  ["e1", printingA],
  ["rule:i2", printingB],
]);

const drag: ListEntryDragData = {
  type: "list-entry",
  selectionIds: ["e1"],
  entryIds: ["e1"],
  copyIds: [],
  fromSelection: true,
  sourceListId: "list-1",
  sourceKind: "printing",
  sourceIntent: "organize",
  totalQuantity: 2,
  printing: printingA,
  previewPrintings: [],
  cardName: "Chaos Rune",
};

describe("resolveListEntrySelection", () => {
  it("leaves a drag that did not start on a selected tile alone", () => {
    const single = { ...drag, fromSelection: false };
    expect(
      resolveListEntrySelection(
        single,
        new Set(["e1", "rule:i2"]),
        entryByItemId,
        printingByEntryId,
      ),
    ).toBe(single);
  });

  it("leaves a selection of one alone", () => {
    expect(resolveListEntrySelection(drag, new Set(["e1"]), entryByItemId, printingByEntryId)).toBe(
      drag,
    );
  });

  it("widens to the selection, splitting rule entries out of the movable rows", () => {
    const resolved = resolveListEntrySelection(
      drag,
      new Set(["e1", "rule:i2"]),
      entryByItemId,
      printingByEntryId,
    );
    expect(resolved.selectionIds).toEqual(["e1", "rule:i2"]);
    expect(resolved.entryIds).toEqual(["e1"]);
    expect(resolved.ruleEntry).toBeUndefined();
    expect(resolved.totalQuantity).toBe(5);
    expect(resolved.previewPrintings).toEqual([printingA, printingB]);
  });
});
