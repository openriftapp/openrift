import { testSearchContext } from "@openrift/shared/test-factories";
import type { Printing } from "@openrift/shared/types/catalog";
import type { ListRule } from "@openrift/shared/types/list-rule";
import { EMPTY_CARD_FILTERS } from "@openrift/shared/types/search";
import { describe, expect, it } from "vitest";

import { stubPrinting } from "@/test/factories";

import { entryToDropTarget, dropEntryFromRules } from "./rule-drop";

const commonA: Printing = stubPrinting({ printingId: "p-a", cardId: "card-a", rarity: "common" });
const rareB: Printing = stubPrinting({ printingId: "p-b", cardId: "card-b", rarity: "rare" });
const catalog = [commonA, rareB];

function wishRule(overrides: Partial<Extract<ListRule, { kind: "wish" }>> = {}): ListRule {
  return {
    kind: "wish",
    filter: { ...EMPTY_CARD_FILTERS, rarities: ["common"] },
    quantity: { mode: "fixed", n: 1 },
    excludeIds: [],
    netOwned: false,
    ...overrides,
  };
}

function tradeRule(overrides: Partial<Extract<ListRule, { kind: "trade" }>> = {}): ListRule {
  return {
    kind: "trade",
    filter: EMPTY_CARD_FILTERS,
    collectionIds: null,
    keepPerCard: { mode: "fixed", n: 0 },
    keepCopyIds: [],
    ...overrides,
  };
}

describe("dropEntryFromRules", () => {
  it("excludes a card from the wish rule whose filter matches it", () => {
    const next = dropEntryFromRules(
      [wishRule()],
      { kind: "card", cardId: "card-a" },
      catalog,
      testSearchContext(),
    );
    expect(next).toEqual([expect.objectContaining({ excludeIds: ["card-a"] })]);
  });

  it("excludes a printing target by printing id", () => {
    const next = dropEntryFromRules(
      [wishRule()],
      { kind: "printing", printingId: "p-a" },
      catalog,
      testSearchContext(),
    );
    expect(next?.[0]).toMatchObject({ excludeIds: ["p-a"] });
  });

  it("adds the id to every wish rule that matches, leaving non-matching rules untouched", () => {
    const rules = [
      wishRule(),
      wishRule({ filter: EMPTY_CARD_FILTERS }),
      wishRule({ filter: { ...EMPTY_CARD_FILTERS, rarities: ["rare"] } }),
    ];
    const next = dropEntryFromRules(
      rules,
      { kind: "card", cardId: "card-a" },
      catalog,
      testSearchContext(),
    );
    expect(next?.map((rule) => (rule.kind === "wish" ? rule.excludeIds : []))).toEqual([
      ["card-a"],
      ["card-a"],
      [],
    ]);
  });

  it("returns null when no rule produces the target", () => {
    const next = dropEntryFromRules(
      [wishRule()],
      { kind: "card", cardId: "card-b" },
      catalog,
      testSearchContext(),
    );
    expect(next).toBeNull();
  });

  it("returns null when the id is already excluded", () => {
    const next = dropEntryFromRules(
      [wishRule({ excludeIds: ["card-a"] })],
      { kind: "card", cardId: "card-a" },
      catalog,
      testSearchContext(),
    );
    expect(next).toBeNull();
  });

  it("pins a copy as kept on the trade rule", () => {
    const next = dropEntryFromRules(
      [tradeRule()],
      { kind: "copy", copyId: "copy-1" },
      catalog,
      testSearchContext(),
    );
    expect(next).toEqual([expect.objectContaining({ keepCopyIds: ["copy-1"] })]);
  });

  it("returns null when the copy is already pinned as kept", () => {
    const next = dropEntryFromRules(
      [tradeRule({ keepCopyIds: ["copy-1"] })],
      { kind: "copy", copyId: "copy-1" },
      catalog,
      testSearchContext(),
    );
    expect(next).toBeNull();
  });

  it("does not mutate the input rules", () => {
    const rules = [wishRule()];
    dropEntryFromRules(rules, { kind: "card", cardId: "card-a" }, catalog, testSearchContext());
    expect(rules[0]).toMatchObject({ excludeIds: [] });
  });
});

describe("entryToDropTarget", () => {
  it("maps each entry kind to the matching id", () => {
    expect(entryToDropTarget({ kind: "card", cardId: "c1" } as never)).toEqual({
      kind: "card",
      cardId: "c1",
    });
    expect(entryToDropTarget({ kind: "printing", printingId: "p1" } as never)).toEqual({
      kind: "printing",
      printingId: "p1",
    });
    expect(entryToDropTarget({ kind: "copy", copyId: "cp1" } as never)).toEqual({
      kind: "copy",
      copyId: "cp1",
    });
  });
});
