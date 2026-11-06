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
    expect(state.removedZoneChips.size).toBe(0);
    expect(state.dismissedAdvance).toBeNull();
    expect(state.replaceTarget).toBeNull();
    expect(state.pendingLegend).toBeNull();
  });

  describe("removeZoneChip", () => {
    it("records the chip under its zone", () => {
      useWorkbenchStore.getState().removeZoneChip("main", "domains:fury");
      expect([...useWorkbenchStore.getState().removedZoneChips]).toEqual(["main:domains:fury"]);
    });

    it("is idempotent for the same chip", () => {
      useWorkbenchStore.getState().removeZoneChip("main", "stats");
      useWorkbenchStore.getState().removeZoneChip("main", "stats");
      expect(useWorkbenchStore.getState().removedZoneChips.size).toBe(1);
    });

    it("keeps chips of different zones apart", () => {
      useWorkbenchStore.getState().removeZoneChip("main", "stats");
      useWorkbenchStore.getState().removeZoneChip("sideboard", "stats");
      expect(useWorkbenchStore.getState().removedZoneChips.size).toBe(2);
    });

    it("replaces the set instance so subscribers see a change", () => {
      const before = useWorkbenchStore.getState().removedZoneChips;
      useWorkbenchStore.getState().removeZoneChip("main", "stats");
      expect(useWorkbenchStore.getState().removedZoneChips).not.toBe(before);
      expect(before.size).toBe(0);
    });
  });

  describe("restoreZoneChips", () => {
    it("clears only the chips of the given zone", () => {
      const store = useWorkbenchStore.getState();
      store.removeZoneChip("main", "stats");
      store.removeZoneChip("main", "domains:fury");
      store.removeZoneChip("sideboard", "stats");
      useWorkbenchStore.getState().restoreZoneChips("main");
      expect([...useWorkbenchStore.getState().removedZoneChips]).toEqual(["sideboard:stats"]);
    });

    it("does nothing when the zone has no removed chips", () => {
      useWorkbenchStore.getState().removeZoneChip("main", "stats");
      useWorkbenchStore.getState().restoreZoneChips("runes");
      expect([...useWorkbenchStore.getState().removedZoneChips]).toEqual(["main:stats"]);
    });

    it("does not clear zones that share a name prefix", () => {
      useWorkbenchStore.getState().removeZoneChip("legend-options", "stats");
      useWorkbenchStore.getState().restoreZoneChips("legend");
      expect([...useWorkbenchStore.getState().removedZoneChips]).toEqual(["legend-options:stats"]);
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
      store.removeZoneChip("main", "stats");
      store.setDismissedAdvance("main");
      store.setReplaceTarget({ cardId: "c", preferredPrintingId: null });
      store.setPendingLegend(stubDeckBuilderCard({ cardType: "legend" }));
      store.announceAdd("Blazing Scorcher", "main");
      useWorkbenchStore.getState().reset();
      const state = useWorkbenchStore.getState();
      expect(state.relaxed).toBe(false);
      expect(state.removedZoneChips.size).toBe(0);
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
