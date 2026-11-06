import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { stubDeckBuilderCard } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

import { useWorkbenchStore } from "./workbench-store";

const resetStore = createStoreResetter(useWorkbenchStore);

beforeEach(resetStore);
afterEach(resetStore);

describe("workbench store", () => {
  it("starts with nothing removed or pending", () => {
    const state = useWorkbenchStore.getState();
    expect(state.relaxed).toBe(false);
    expect(state.showAllCardsZones.size).toBe(0);
    expect(state.dismissedAdvance).toBeNull();
    expect(state.replaceTarget).toBeNull();
    expect(state.pendingLegend).toBeNull();
  });

  describe("setShowAllCards", () => {
    it("turns the zone fit off for one zone only", () => {
      useWorkbenchStore.getState().setShowAllCards("runes", true);
      expect([...useWorkbenchStore.getState().showAllCardsZones]).toEqual(["runes"]);
    });

    it("turns it back on", () => {
      useWorkbenchStore.getState().setShowAllCards("runes", true);
      useWorkbenchStore.getState().setShowAllCards("runes", false);
      expect(useWorkbenchStore.getState().showAllCardsZones.size).toBe(0);
    });

    it("replaces the set instance so subscribers see a change", () => {
      const before = useWorkbenchStore.getState().showAllCardsZones;
      useWorkbenchStore.getState().setShowAllCards("main", true);
      expect(useWorkbenchStore.getState().showAllCardsZones).not.toBe(before);
    });
  });

  describe("announceAdd", () => {
    it("records the latest add and reset clears it", () => {
      useWorkbenchStore.getState().announceAdd("Blazing Scorcher", "main");
      expect(useWorkbenchStore.getState().lastAdd).toEqual({
        cardName: "Blazing Scorcher",
        zone: "main",
      });
      useWorkbenchStore.getState().reset();
      expect(useWorkbenchStore.getState().lastAdd).toBeNull();
    });
  });

  describe("setPendingLegend", () => {
    it("stores and clears the pending legend", () => {
      const legend = stubDeckBuilderCard({ cardType: "legend" });
      useWorkbenchStore.getState().setPendingLegend(legend);
      expect(useWorkbenchStore.getState().pendingLegend).toBe(legend);
      useWorkbenchStore.getState().setPendingLegend(null);
      expect(useWorkbenchStore.getState().pendingLegend).toBeNull();
    });
  });

  describe("reset", () => {
    it("restores every field to its initial value", () => {
      const store = useWorkbenchStore.getState();
      store.setRelaxed(true);
      store.setShowAllCards("main", true);
      store.setDismissedAdvance("main");
      store.setReplaceTarget({ cardId: "c", preferredPrintingId: null });
      store.setPendingLegend(stubDeckBuilderCard({ cardType: "legend" }));
      store.announceAdd("Blazing Scorcher", "main");
      useWorkbenchStore.getState().reset();
      const state = useWorkbenchStore.getState();
      expect(state.relaxed).toBe(false);
      expect(state.showAllCardsZones.size).toBe(0);
      expect(state.dismissedAdvance).toBeNull();
      expect(state.replaceTarget).toBeNull();
      expect(state.pendingLegend).toBeNull();
      expect(state.lastAdd).toBeNull();
    });
  });

  describe("setZoneCollapsed", () => {
    it("collapses and reopens a zone without touching others", () => {
      const { setZoneCollapsed } = useWorkbenchStore.getState();
      setZoneCollapsed("sideboard", true);
      setZoneCollapsed("main", true);
      setZoneCollapsed("main", false);
      expect([...useWorkbenchStore.getState().collapsedZones]).toEqual(["sideboard"]);
    });

    it("starts with every zone open and reset reopens them", () => {
      expect(useWorkbenchStore.getState().collapsedZones.size).toBe(0);
      useWorkbenchStore.getState().setZoneCollapsed("overflow", true);
      useWorkbenchStore.getState().reset();
      expect(useWorkbenchStore.getState().collapsedZones.size).toBe(0);
    });
  });

  describe("simple setters", () => {
    it("sets relaxed", () => {
      useWorkbenchStore.getState().setRelaxed(true);
      expect(useWorkbenchStore.getState().relaxed).toBe(true);
    });

    it("sets and clears the dismissed advance zone", () => {
      useWorkbenchStore.getState().setDismissedAdvance("legend");
      expect(useWorkbenchStore.getState().dismissedAdvance).toBe("legend");
      useWorkbenchStore.getState().setDismissedAdvance(null);
      expect(useWorkbenchStore.getState().dismissedAdvance).toBeNull();
    });

    it("sets and clears the replace target", () => {
      const target = { cardId: "bf-1", preferredPrintingId: "foil" };
      useWorkbenchStore.getState().setReplaceTarget(target);
      expect(useWorkbenchStore.getState().replaceTarget).toEqual(target);
      useWorkbenchStore.getState().setReplaceTarget(null);
      expect(useWorkbenchStore.getState().replaceTarget).toBeNull();
    });
  });
});
