import { describe, expect, it } from "vitest";

import type { CardViewerItem } from "@/lib/card-viewer-types";
import { stubPrinting } from "@/test/factories";

import type { SelectionAnchorState } from "./resolve-selection";
import { resolveSelection } from "./resolve-selection";

const alpha = stubPrinting({ printingId: "p1", cardId: "c1", card: { name: "Alpha" } });
const beta = stubPrinting({ printingId: "p2", cardId: "c2", card: { name: "Beta" } });
const gamma = stubPrinting({ printingId: "p3", cardId: "c3", card: { name: "Gamma" } });

const list = (...entries: [string, typeof alpha][]): CardViewerItem[] =>
  entries.map(([id, printing]) => ({ id, printing }));

function selected(
  item: CardViewerItem,
  source: readonly CardViewerItem[],
  overrides: Partial<SelectionAnchorState> = {},
): SelectionAnchorState {
  return {
    selectedCard: item.printing,
    selectedItemId: item.id,
    selectedZone: item.zone ?? null,
    sourceIds: source.map((entry) => entry.id),
    outlivesList: true,
    ...overrides,
  };
}

describe("resolveSelection", () => {
  it("finds the selected tile after a reorder", () => {
    const items = list(["p1", alpha], ["p2", beta]);
    const state = selected(items[0]!, items);

    const resolved = resolveSelection(state, list(["p2", beta], ["p1", alpha]));

    expect(resolved.index).toBe(1);
    expect(resolved.card?.printingId).toBe("p1");
  });

  it("keeps the clicked copy when several tiles share a printing", () => {
    const items = list(["copy-1", alpha], ["copy-2", alpha]);

    const resolved = resolveSelection(selected(items[1]!, items), items);

    expect(resolved.index).toBe(1);
    expect(resolved.item?.id).toBe("copy-2");
  });

  it("moves onto the card that took the removed one's place", () => {
    const items = list(["p1", alpha], ["p2", beta], ["p3", gamma]);

    const resolved = resolveSelection(
      selected(items[1]!, items),
      list(["p1", alpha], ["p3", gamma]),
    );

    expect(resolved.card?.printingId).toBe("p3");
    expect(resolved.index).toBe(1);
  });

  it("falls back to the previous card when the removed one was at the end", () => {
    const items = list(["p1", alpha], ["p2", beta]);

    const resolved = resolveSelection(selected(items[1]!, items), list(["p1", alpha]));

    expect(resolved.card?.printingId).toBe("p1");
    expect(resolved.index).toBe(0);
  });

  it("keeps the card without a tile when the list empties", () => {
    const items = list(["p1", alpha]);

    const resolved = resolveSelection(selected(items[0]!, items), []);

    expect(resolved.card?.printingId).toBe("p1");
    expect(resolved.index).toBe(-1);
  });

  it("drops a selection that may not outlive its list once the list empties", () => {
    const items = list(["copy-1", alpha]);

    const resolved = resolveSelection(selected(items[0]!, items, { outlivesList: false }), []);

    expect(resolved.card).toBeNull();
    expect(resolved.index).toBe(-1);
  });

  it("drops a selection that may not outlive its list even when a neighbour survives", () => {
    const items = list(["copy-1", alpha], ["copy-2", beta]);

    const resolved = resolveSelection(
      selected(items[0]!, items, { outlivesList: false }),
      list(["copy-2", beta]),
    );

    expect(resolved.card).toBeNull();
  });

  it("moves a list-bound selection to another copy of its printing", () => {
    const items = list(["copy-1", alpha], ["copy-2", alpha], ["copy-3", beta]);

    const resolved = resolveSelection(
      selected(items[0]!, items, { outlivesList: false }),
      list(["copy-2", alpha], ["copy-3", beta]),
    );

    expect(resolved.item?.id).toBe("copy-2");
  });

  it("keeps a deck-list card when the catalog beside it has no results", () => {
    const deck: CardViewerItem[] = [{ id: "main:p1", printing: alpha, zone: "main" }];

    const resolved = resolveSelection(selected(deck[0]!, deck), []);

    expect(resolved.card?.printingId).toBe("p1");
  });

  it("keeps a picked sibling printing that has no tile of its own", () => {
    const sibling = stubPrinting({ printingId: "p1-alt", cardId: "c1", card: { name: "Alpha" } });
    const items = list(["p1", alpha]);

    const resolved = resolveSelection(selected(items[0]!, items, { selectedCard: sibling }), items);

    expect(resolved.card?.printingId).toBe("p1-alt");
    expect(resolved.index).toBe(0);
  });

  it("moves to another copy of the printing when the selected copy leaves", () => {
    const items = list(["copy-1", alpha], ["copy-2", alpha]);

    const resolved = resolveSelection(selected(items[1]!, items), list(["copy-1", alpha]));

    expect(resolved.index).toBe(0);
    expect(resolved.card?.printingId).toBe("p1");
  });

  it("stays within the selected zone on the deck overview", () => {
    const items: CardViewerItem[] = [
      { id: "main:p1", printing: alpha, zone: "main" },
      { id: "sideboard:p1", printing: alpha, zone: "sideboard" },
      { id: "sideboard:p2", printing: beta, zone: "sideboard" },
    ];

    const resolved = resolveSelection(selected(items[1]!, items), [
      { id: "main:p1", printing: alpha, zone: "main" },
      { id: "sideboard:p2", printing: beta, zone: "sideboard" },
    ]);

    expect(resolved.item?.id).toBe("sideboard:p2");
  });

  it("finds a deck-list card in the catalog by printing", () => {
    const deck: CardViewerItem[] = [{ id: "main:p1", printing: alpha, zone: "main" }];

    const resolved = resolveSelection(selected(deck[0]!, deck), list(["p2", beta], ["p1", alpha]));

    expect(resolved.index).toBe(1);
    expect(resolved.card?.printingId).toBe("p1");
  });

  it("keeps a deck-list card the catalog lacks, without a tile", () => {
    const deck: CardViewerItem[] = [
      { id: "main:p1", printing: alpha, zone: "main" },
      { id: "main:p2", printing: beta, zone: "main" },
    ];

    const resolved = resolveSelection(selected(deck[0]!, deck), list(["p3", gamma]));

    expect(resolved.card?.printingId).toBe("p1");
    expect(resolved.index).toBe(-1);
  });

  it("has no selection when nothing is selected", () => {
    const resolved = resolveSelection(
      {
        selectedCard: null,
        selectedItemId: null,
        selectedZone: null,
        sourceIds: [],
        outlivesList: true,
      },
      list(["p1", alpha]),
    );

    expect(resolved.card).toBeNull();
  });
});
