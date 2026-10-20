import type { ListEntryDetailResponse } from "@openrift/shared/types/api/list";
import type { Printing } from "@openrift/shared/types/catalog";
import { describe, expect, it } from "vitest";

import { EMPTY_TRADE_PREFERENCE, stubPrinting } from "@/test/factories";

import {
  collectListPrintings,
  kindToView,
  resolveCopyMoveTarget,
  resolveEntryPrinting,
  selectableEntryIds,
} from "./list-entries";

const entryBase = {
  listId: "list-1",
  quantity: 1,
  tradeOverride: EMPTY_TRADE_PREFERENCE,
  source: "manual" as const,
  ruleQuantity: 0,
  cardName: "Test Card",
  cardType: "Unit",
};

const printingFields = {
  setId: "set-1",
  rarity: "common",
  finish: "normal",
  shortCode: "RB1-001",
  language: "EN",
  imageId: null,
};

function cardEntry(id: string, cardId: string): ListEntryDetailResponse {
  return { ...entryBase, id, kind: "card", cardId };
}

function printingEntry(id: string, printingId: string): ListEntryDetailResponse {
  return { ...entryBase, id, kind: "printing", printingId, ...printingFields };
}

function copyEntry(id: string | null, copyId: string, printingId: string): ListEntryDetailResponse {
  return {
    ...entryBase,
    id,
    kind: "copy",
    copyId,
    printingId,
    ...printingFields,
    reserved: false,
    onLoan: false,
  };
}

describe("kindToView", () => {
  it("maps each list kind to its view mode", () => {
    expect(kindToView("card")).toBe("cards");
    expect(kindToView("printing")).toBe("printings");
    expect(kindToView("copy")).toBe("copies");
  });
});

describe("resolveEntryPrinting", () => {
  const printing = stubPrinting({ printingId: "p1", cardId: "c1" });
  const printingsById: Record<string, Printing> = { p1: printing };
  const printingsByCardId = new Map([["c1", [printing]]]);

  it("resolves printing entries by printingId", () => {
    expect(resolveEntryPrinting(printingEntry("e1", "p1"), printingsById, printingsByCardId)).toBe(
      printing,
    );
  });

  it("resolves copy entries by the underlying printingId", () => {
    expect(
      resolveEntryPrinting(copyEntry("e1", "copy-1", "p1"), printingsById, printingsByCardId),
    ).toBe(printing);
  });

  it("resolves card entries to the card's first printing", () => {
    expect(resolveEntryPrinting(cardEntry("e1", "c1"), printingsById, printingsByCardId)).toBe(
      printing,
    );
  });

  it("returns undefined when nothing resolves", () => {
    expect(
      resolveEntryPrinting(printingEntry("e1", "missing"), printingsById, printingsByCardId),
    ).toBeUndefined();
    expect(
      resolveEntryPrinting(cardEntry("e1", "missing"), printingsById, printingsByCardId),
    ).toBeUndefined();
  });
});

describe("collectListPrintings", () => {
  const printingA = stubPrinting({ printingId: "pa", cardId: "ca" });
  const printingB = stubPrinting({ printingId: "pb", cardId: "cb" });
  const printingsById: Record<string, Printing> = { pa: printingA, pb: printingB };
  const printingsByCardId = new Map([
    ["ca", [printingA]],
    ["cb", [printingB]],
  ]);

  it("returns empty results for no entries", () => {
    const { listPrintings, entriesBySideKey } = collectListPrintings(
      [],
      printingsById,
      printingsByCardId,
    );
    expect(listPrintings).toEqual([]);
    expect(entriesBySideKey.size).toBe(0);
  });

  it("lists both sides of a double-sided printing entry once", () => {
    const front = stubPrinting({ printingId: "pa", side: 1, cardId: "ca" });
    const back = stubPrinting({ printingId: "pa", side: 2, cardId: "gold" });
    const entry = printingEntry("e1", "pa");
    const { listPrintings, entriesBySideKey } = collectListPrintings(
      [entry],
      { pa: front },
      printingsByCardId,
      new Map([["pa", [front, back]]]),
    );
    expect(listPrintings).toEqual([front, back]);
    expect(entriesBySideKey.get("pa")).toEqual([entry]);
  });

  it("keeps card entries for both cards of one double-sided printing apart", () => {
    const front = stubPrinting({ printingId: "pair", side: 1, cardId: "bird" });
    const back = stubPrinting({ printingId: "pair", side: 2, cardId: "gold" });
    const bird = cardEntry("e1", "bird");
    const gold = cardEntry("e2", "gold");
    const { listPrintings, entriesBySideKey } = collectListPrintings(
      [bird, gold],
      { pair: front },
      new Map([
        ["bird", [front]],
        ["gold", [back]],
      ]),
    );
    expect(listPrintings).toEqual([front, back]);
    expect(entriesBySideKey.get("pair")).toEqual([bird]);
    expect(entriesBySideKey.get("pair:2")).toEqual([gold]);
  });

  it("dedupes printings and groups entries per printing in entry order", () => {
    const first = printingEntry("e1", "pa");
    const second = copyEntry("e2", "copy-1", "pa");
    const third = printingEntry("e3", "pb");
    const { listPrintings, entriesBySideKey } = collectListPrintings(
      [first, second, third],
      printingsById,
      printingsByCardId,
    );
    expect(listPrintings).toEqual([printingA, printingB]);
    expect(entriesBySideKey.get("pa")).toEqual([first, second]);
    expect(entriesBySideKey.get("pb")).toEqual([third]);
  });

  it("skips entries whose printing cannot be resolved", () => {
    const resolvable = cardEntry("e1", "ca");
    const unresolvable = printingEntry("e2", "missing");
    const { listPrintings, entriesBySideKey } = collectListPrintings(
      [resolvable, unresolvable],
      printingsById,
      printingsByCardId,
    );
    expect(listPrintings).toEqual([printingA]);
    expect(entriesBySideKey.size).toBe(1);
  });
});

describe("selectableEntryIds", () => {
  const first = copyEntry("e1", "copy-1", "pa");
  const ruleProduced = copyEntry(null, "copy-2", "pb");
  const second = copyEntry("e3", "copy-3", "pc");

  it("returns one id per tile, in display order", () => {
    const items = [
      { id: "e1", printing: stubPrinting({ printingId: "pa" }) },
      { id: "e3", printing: stubPrinting({ printingId: "pc" }) },
    ];
    const entryByItemId = new Map([
      ["e1", first],
      ["e3", second],
    ]);
    expect(selectableEntryIds(items, entryByItemId)).toEqual(["e1", "e3"]);
  });

  it("gives rule-produced entries a tile-scoped id", () => {
    const items = [
      { id: "e1", printing: stubPrinting({ printingId: "pa" }) },
      { id: "copy-2", printing: stubPrinting({ printingId: "pb" }) },
    ];
    const entryByItemId = new Map([
      ["e1", first],
      ["copy-2", ruleProduced],
    ]);
    expect(selectableEntryIds(items, entryByItemId)).toEqual(["e1", "rule:copy-2"]);
  });

  it("returns one id for both side tiles of a double-sided entry", () => {
    const pairEntry = printingEntry("e9", "pair");
    const ruleEntry = { ...printingEntry("x", "rule-pair"), id: null };
    const items = [
      { id: "pair", printing: stubPrinting({ printingId: "pair", side: 1 }) },
      { id: "pair:2", printing: stubPrinting({ printingId: "pair", side: 2 }) },
      { id: "rule-pair", printing: stubPrinting({ printingId: "rule-pair", side: 1 }) },
      { id: "rule-pair:2", printing: stubPrinting({ printingId: "rule-pair", side: 2 }) },
    ];
    const entryByItemId = new Map([
      ["pair", pairEntry],
      ["pair:2", pairEntry],
      ["rule-pair", ruleEntry],
      ["rule-pair:2", ruleEntry],
    ]);
    expect(selectableEntryIds(items, entryByItemId)).toEqual(["e9", "rule:rule-pair"]);
  });

  it("skips tiles with no entry behind them", () => {
    const items = [{ id: "pz", printing: stubPrinting({ printingId: "pz" }) }];
    expect(selectableEntryIds(items, new Map())).toEqual([]);
  });

  it("returns nothing for an empty grid", () => {
    expect(selectableEntryIds([], new Map())).toEqual([]);
  });
});

describe("resolveCopyMoveTarget", () => {
  const selectable = copyEntry("e1", "copy-1", "pa");
  const alsoSelectable = copyEntry("e2", "copy-2", "pb");
  const ruleProduced = copyEntry(null, "copy-3", "pa");
  const entryByItemId = new Map([
    ["i1", selectable],
    ["i2", alsoSelectable],
    ["i3", ruleProduced],
  ]);

  it("targets just the clicked copy when nothing is selected", () => {
    expect(resolveCopyMoveTarget(entryByItemId, new Set(), "copy-1")).toEqual(["copy-1"]);
  });

  it("targets just the clicked copy when the selection does not contain it", () => {
    expect(resolveCopyMoveTarget(entryByItemId, new Set(["e2"]), "copy-1")).toEqual(["copy-1"]);
  });

  it("widens to the whole selection when the clicked copy is part of it", () => {
    const target = resolveCopyMoveTarget(entryByItemId, new Set(["e1", "e2"]), "copy-1");
    expect(target).toEqual(["copy-1", "copy-2"]);
  });

  it("carries a selected rule-produced copy along", () => {
    const target = resolveCopyMoveTarget(entryByItemId, new Set(["e1", "rule:i3"]), "copy-1");
    expect(target).toEqual(["copy-1", "copy-3"]);
  });

  it("drops selected entries that have no copy behind them", () => {
    const mixed = new Map([
      ["i1", selectable],
      ["i9", cardEntry("e9", "ca")],
    ]);
    expect(resolveCopyMoveTarget(mixed, new Set(["e1", "e9"]), "copy-1")).toEqual(["copy-1"]);
  });

  it("falls back to the clicked copy when it is not on the list at all", () => {
    expect(resolveCopyMoveTarget(entryByItemId, new Set(["e1"]), "copy-unknown")).toEqual([
      "copy-unknown",
    ]);
  });
});
