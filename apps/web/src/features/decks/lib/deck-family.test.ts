import { describe, expect, it } from "vitest";

import { collapseFamilies, withVariantPanels } from "./deck-family";

interface TestItem {
  deck: { id: string; familyId: string | null; isPrimary: boolean };
}

function makeItem(id: string, familyId: string | null = null, isPrimary = false): TestItem {
  return { deck: { id, familyId, isPrimary } };
}

/** Ids in render order, with a "+" marking entries that carry family info. */
function render(entries: ReturnType<typeof collapseFamilies<TestItem>>): string[] {
  return entries.map((entry) => (entry.family ? `${entry.item.deck.id}+` : entry.item.deck.id));
}

describe("collapseFamilies", () => {
  it("returns nothing for an empty list", () => {
    expect(collapseFamilies<TestItem>([], new Set())).toEqual([]);
  });

  it("passes standalone decks through untouched", () => {
    const items = [makeItem("a"), makeItem("b")];
    const entries = collapseFamilies(items, new Set());
    expect(entries).toEqual([{ item: items[0] }, { item: items[1] }]);
  });

  it("fronts a collapsed family with its primary, at the primary's own position", () => {
    const items = [
      makeItem("budget", "fam"),
      makeItem("solo"),
      makeItem("main", "fam", true),
      makeItem("tourney", "fam"),
    ];
    const entries = collapseFamilies(items, new Set());
    expect(render(entries)).toEqual(["solo", "main+"]);
    expect(entries[1]?.family).toEqual({
      id: "fam",
      memberCount: 3,
      expanded: false,
      role: "front",
    });
  });

  it("reveals the remaining members in list order when expanded", () => {
    const items = [
      makeItem("budget", "fam"),
      makeItem("main", "fam", true),
      makeItem("tourney", "fam"),
      makeItem("solo"),
    ];
    const entries = collapseFamilies(items, new Set(["fam"]));
    expect(render(entries)).toEqual(["main+", "budget+", "tourney+", "solo"]);
    expect(entries.map((entry) => entry.family?.role)).toEqual([
      "front",
      "member",
      "member",
      undefined,
    ]);
    expect(entries[1]?.family?.expanded).toBe(true);
  });

  it("falls back to the first member when the primary is not in the list", () => {
    const items = [makeItem("budget", "fam"), makeItem("tourney", "fam")];
    const entries = collapseFamilies(items, new Set(["fam"]));
    expect(render(entries)).toEqual(["budget+", "tourney+"]);
    expect(entries[0]?.family?.memberCount).toBe(2);
  });

  it("counts only the members present in this list", () => {
    const entries = collapseFamilies([makeItem("main", "fam", true)], new Set());
    expect(entries[0]?.family).toEqual({
      id: "fam",
      memberCount: 1,
      expanded: false,
      role: "front",
    });
  });

  it("keeps several families independent", () => {
    const items = [
      makeItem("a1", "one", true),
      makeItem("a2", "one"),
      makeItem("b1", "two", true),
      makeItem("b2", "two"),
    ];
    expect(render(collapseFamilies(items, new Set(["two"])))).toEqual(["a1+", "b1+", "b2+"]);
  });

  it("ignores an expanded id that no longer matches a family", () => {
    const items = [makeItem("solo"), makeItem("main", "fam", true)];
    expect(render(collapseFamilies(items, new Set(["gone"])))).toEqual(["solo", "main+"]);
  });
});

describe("withVariantPanels", () => {
  function grid(items: TestItem[], expanded: string[]): string[] {
    return withVariantPanels(collapseFamilies(items, new Set(expanded))).map((entry) =>
      entry.kind === "deck"
        ? entry.entry.item.deck.id
        : `[${entry.items.map((item) => item.deck.id).join(",")}]`,
    );
  }

  it("returns nothing for an empty list", () => {
    expect(withVariantPanels<TestItem>([])).toEqual([]);
  });

  it("passes standalone decks and collapsed families through", () => {
    const items = [makeItem("solo"), makeItem("main", "fam", true), makeItem("alt", "fam")];
    expect(grid(items, [])).toEqual(["solo", "main"]);
  });

  it("puts an expanded family's front and members into a panel after the front", () => {
    const items = [
      makeItem("solo"),
      makeItem("alt", "fam"),
      makeItem("main", "fam", true),
      makeItem("other"),
      makeItem("budget", "fam"),
    ];
    expect(grid(items, ["fam"])).toEqual(["solo", "main", "[main,alt,budget]", "other"]);
  });

  it("keeps two expanded families in separate panels", () => {
    const items = [
      makeItem("a1", "a", true),
      makeItem("a2", "a"),
      makeItem("b1", "b", true),
      makeItem("b2", "b"),
    ];
    expect(grid(items, ["a", "b"])).toEqual(["a1", "[a1,a2]", "b1", "[b1,b2]"]);
  });

  it("opens no panel for an expanded family with a single deck left in the list", () => {
    expect(grid([makeItem("main", "fam", true)], ["fam"])).toEqual(["main"]);
  });
});
