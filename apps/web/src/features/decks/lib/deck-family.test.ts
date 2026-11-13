import { describe, expect, it } from "vitest";

import type { DeckFamilyEntry } from "./deck-family";
import {
  collapseFamilies,
  familyFrontView,
  storedDecksShown,
  withVariantPanels,
} from "./deck-family";

interface TestItem {
  deck: {
    id: string;
    name: string;
    familyId: string | null;
    collectionId: string | null;
    isPrimary: boolean;
    updatedAt: string;
  };
  familyName: string | null;
}

const DAY = "2026-01-01T00:00:00.000Z";

function makeItem(
  id: string,
  familyId: string | null = null,
  isPrimary = false,
  extra: { updatedAt?: string; familyName?: string | null; collectionId?: string } = {},
): TestItem {
  return {
    deck: {
      id,
      name: `Deck ${id}`,
      familyId,
      collectionId: extra.collectionId ?? null,
      isPrimary,
      updatedAt: extra.updatedAt ?? DAY,
    },
    familyName: extra.familyName ?? null,
  };
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
      name: null,
      updatedAt: DAY,
      memberCount: 3,
      stored: [],
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
      name: null,
      updatedAt: DAY,
      memberCount: 1,
      stored: [],
      expanded: false,
      role: "front",
    });
  });

  it("names the group and dates it by its newest member", () => {
    const items = [
      makeItem("main", "fam", true, { updatedAt: "2026-11-05T00:00:00.000Z" }),
      makeItem("fresh", "fam", false, {
        updatedAt: "2026-11-09T00:00:00.000Z",
        familyName: "Orianna",
      }),
    ];
    const [front] = collapseFamilies(items, new Set());
    expect(front?.item.deck.id).toBe("main");
    expect(front?.family?.name).toBe("Orianna");
    expect(front?.family?.updatedAt).toBe("2026-11-09T00:00:00.000Z");
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

describe("storedDecksShown", () => {
  const items = [
    makeItem("main", "fam", true),
    makeItem("budget", "fam", false, { collectionId: "box-1" }),
    makeItem("tourney", "fam", false, { collectionId: "box-2" }),
  ];

  it("collects every boxed member onto the family", () => {
    const [entry] = collapseFamilies(items, new Set());
    expect(entry?.family?.stored).toEqual([
      { deckId: "budget", deckName: "Deck budget", collectionId: "box-1" },
      { deckId: "tourney", deckName: "Deck tourney", collectionId: "box-2" },
    ]);
  });

  it("shows the variants' boxes on a collapsed front", () => {
    const [entry] = collapseFamilies(items, new Set());
    expect(entry && storedDecksShown(entry.item.deck, entry.family)).toHaveLength(2);
  });

  it("shows only each deck's own box once the family is expanded", () => {
    const entries = collapseFamilies(items, new Set(["fam"]));
    expect(entries.map((entry) => storedDecksShown(entry.item.deck, entry.family))).toEqual([
      [],
      [{ deckId: "budget", deckName: "Deck budget", collectionId: "box-1" }],
      [{ deckId: "tourney", deckName: "Deck tourney", collectionId: "box-2" }],
    ]);
  });

  it("shows a standalone deck's own box", () => {
    const deck = makeItem("solo", null, false, { collectionId: "box-1" }).deck;
    expect(storedDecksShown(deck)).toEqual([
      { deckId: "solo", deckName: "Deck solo", collectionId: "box-1" },
    ]);
    expect(storedDecksShown(makeItem("bare").deck)).toEqual([]);
  });
});

describe("familyFrontView", () => {
  const item = { deck: { name: "RAD Heron", updatedAt: "2026-11-05T00:00:00.000Z" } };
  const front: DeckFamilyEntry = {
    id: "fam",
    name: "Orianna",
    updatedAt: "2026-11-09T00:00:00.000Z",
    memberCount: 2,
    stored: [],
    expanded: false,
    role: "front",
  };

  it("leaves a standalone deck as it is", () => {
    expect(familyFrontView(item)).toEqual({
      title: "RAD Heron",
      isNamedGroup: false,
      metaItem: item,
    });
  });

  it("titles a named front with the group name and dates it by the group", () => {
    const view = familyFrontView(item, front);
    expect(view.title).toBe("Orianna");
    expect(view.isNamedGroup).toBe(true);
    expect(view.metaItem.deck.updatedAt).toBe("2026-11-09T00:00:00.000Z");
  });

  it("keeps the deck name on an unnamed front", () => {
    const view = familyFrontView(item, { ...front, name: null });
    expect(view.title).toBe("RAD Heron");
    expect(view.isNamedGroup).toBe(false);
  });

  it("changes nothing on a revealed member", () => {
    expect(familyFrontView(item, { ...front, role: "member" }).title).toBe("RAD Heron");
  });
});
