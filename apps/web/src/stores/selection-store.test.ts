import { sideKey } from "@openrift/shared/printing-side";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { selectionFindBy } from "@/features/cards/lib/card-tiles";
import { resetIdCounter, stubPrinting } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

import { useSelectionStore } from "./selection-store";

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useSelectionStore);
  resetIdCounter();
});

afterEach(() => {
  resetStore();
});

describe("useSelectionStore", () => {
  describe("selectCard", () => {
    it("selects the clicked rarity tile when one card has printings in two rarities", () => {
      const common = stubPrinting({ cardId: "card-1", rarity: "common" });
      const rare = stubPrinting({ cardId: "card-1", rarity: "rare" });
      const items = [common, rare].map((printing) => ({ id: sideKey(printing), printing }));

      useSelectionStore.getState().selectCard(rare, items, selectionFindBy("cards", "rarity"));

      expect(useSelectionStore.getState().selectedItemId).toBe(sideKey(rare));
    });

    it("lets a selection outlive its list unless the caller says otherwise", () => {
      const printing = stubPrinting({ printingId: "p1", cardId: "c1", card: { name: "Alpha" } });
      const items = [{ id: "p1", printing }];

      useSelectionStore.getState().selectCard(printing, items, "printing");
      expect(useSelectionStore.getState().outlivesList).toBe(true);

      useSelectionStore.getState().selectCard(printing, items, "printing", { outlivesList: false });
      expect(useSelectionStore.getState().outlivesList).toBe(false);
    });

    it("selects a card by printing id and opens detail", () => {
      const printing = stubPrinting({ printingId: "p1", cardId: "c1", card: { name: "Alpha" } });
      const items = [{ id: "p1", printing }];

      useSelectionStore.getState().selectCard(printing, items, "printing");

      const state = useSelectionStore.getState();
      expect(state.selectedCard?.printingId).toBe("p1");
      expect(state.selectedItemId).toBe("p1");
      expect(state.sourceIds).toEqual(["p1"]);
      expect(state.detailOpen).toBe(true);
    });

    it("selects a card by card id", () => {
      const printing1 = stubPrinting({ printingId: "p1", cardId: "c1", card: { name: "Alpha" } });
      const printing2 = stubPrinting({ printingId: "p2", cardId: "c2", card: { name: "Beta" } });
      const items = [
        { id: "p1", printing: printing1 },
        { id: "p2", printing: printing2 },
      ];

      useSelectionStore.getState().selectCard(printing2, items, "card");

      expect(useSelectionStore.getState().selectedItemId).toBe("p2");
    });

    it("leaves the item unset when card is not found in items", () => {
      const printing = stubPrinting({ printingId: "p-missing", cardId: "c-missing" });

      useSelectionStore.getState().selectCard(printing, [], "printing");

      expect(useSelectionStore.getState().selectedItemId).toBeNull();
    });

    it("disambiguates by zone when the same card appears in multiple zones", () => {
      const printing = stubPrinting({ printingId: "p1", cardId: "c1", card: { name: "Alpha" } });
      const items = [
        { id: "main:p1", printing, zone: "main" as const },
        { id: "sideboard:p1", printing, zone: "sideboard" as const },
      ];

      useSelectionStore.getState().selectCard(printing, items, "card", { zone: "sideboard" });

      const state = useSelectionStore.getState();
      expect(state.selectedItemId).toBe("sideboard:p1");
      expect(state.selectedZone).toBe("sideboard");
    });

    it("anchors on the clicked copy when several tiles share a printing", () => {
      const printing = stubPrinting({ printingId: "p1", cardId: "c1", card: { name: "Alpha" } });
      const items = [
        { id: "copy-1", printing },
        { id: "copy-2", printing },
        { id: "copy-3", printing },
      ];

      useSelectionStore.getState().selectCard(printing, items, "printing", { itemId: "copy-3" });

      expect(useSelectionStore.getState().selectedItemId).toBe("copy-3");
    });

    it("falls back to the printing lookup when the item id is not in the list", () => {
      const printing = stubPrinting({ printingId: "p1", cardId: "c1" });
      const items = [{ id: "copy-1", printing }];

      useSelectionStore.getState().selectCard(printing, items, "printing", { itemId: "gone" });

      expect(useSelectionStore.getState().selectedItemId).toBe("copy-1");
    });

    it("leaves selectedZone null when zone is omitted (catalog path)", () => {
      const printing = stubPrinting({ printingId: "p1", cardId: "c1" });
      useSelectionStore.getState().selectCard(printing, [{ id: "p1", printing }], "printing");

      expect(useSelectionStore.getState().selectedZone).toBeNull();
    });
  });

  describe("navigateToItem", () => {
    it("moves to the item without affecting detailOpen", () => {
      const a = stubPrinting({ printingId: "p1" });
      const b = stubPrinting({ printingId: "p2" });
      const items = [
        { id: "p1", printing: a },
        { id: "p2", printing: b, zone: "sideboard" as const },
      ];
      useSelectionStore.getState().navigateToItem(items, 1);

      const state = useSelectionStore.getState();
      expect(state.selectedItemId).toBe("p2");
      expect(state.selectedCard?.printingId).toBe("p2");
      expect(state.selectedZone).toBe("sideboard");
      expect(state.sourceIds).toEqual(["p1", "p2"]);
      expect(state.detailOpen).toBe(false);
    });

    it("shows the given sibling printing on the item's tile", () => {
      const a = stubPrinting({ printingId: "p1", cardId: "c1" });
      const alt = stubPrinting({ printingId: "p1-alt", cardId: "c1" });
      useSelectionStore.getState().navigateToItem([{ id: "p1", printing: a }], 0, alt);

      const state = useSelectionStore.getState();
      expect(state.selectedItemId).toBe("p1");
      expect(state.selectedCard?.printingId).toBe("p1-alt");
    });

    it("ignores an index outside the list", () => {
      const a = stubPrinting({ printingId: "p1" });
      useSelectionStore.getState().navigateToItem([{ id: "p1", printing: a }], 3);

      expect(useSelectionStore.getState().selectedCard).toBeNull();
    });
  });

  describe("setSelectedCard", () => {
    it("changes the printing without changing index or open state", () => {
      const first = stubPrinting({ printingId: "p1" });
      useSelectionStore.getState().selectCard(first, [{ id: "p1", printing: first }], "printing");

      const second = stubPrinting({ printingId: "p2" });
      useSelectionStore.getState().setSelectedCard(second);

      const state = useSelectionStore.getState();
      expect(state.selectedCard?.printingId).toBe("p2");
      expect(state.selectedItemId).toBe("p1");
      expect(state.detailOpen).toBe(true);
    });
  });

  describe("closeDetail", () => {
    it("clears selection and closes detail pane", () => {
      const printing = stubPrinting({ printingId: "p1" });
      useSelectionStore.getState().selectCard(printing, [{ id: "p1", printing }], "printing");

      useSelectionStore.getState().closeDetail();

      const state = useSelectionStore.getState();
      expect(state.selectedCard).toBeNull();
      expect(state.selectedItemId).toBeNull();
      expect(state.detailOpen).toBe(false);
    });

    it("clears selectedZone", () => {
      useSelectionStore.setState({ selectedZone: "main" });
      useSelectionStore.getState().closeDetail();

      expect(useSelectionStore.getState().selectedZone).toBeNull();
    });
  });
});
