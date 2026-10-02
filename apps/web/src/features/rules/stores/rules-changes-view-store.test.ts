import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import { isRulesChangesView, useRulesChangesViewStore } from "./rules-changes-view-store";

describe("rules-changes-view-store", () => {
  let resetStore: () => void;

  beforeEach(() => {
    resetStore = createStoreResetter(useRulesChangesViewStore);
  });

  afterEach(() => {
    resetStore();
  });

  it("defaults to off for both kinds", () => {
    expect(useRulesChangesViewStore.getState().byKind).toEqual({
      core: "off",
      tournament: "off",
    });
  });

  it("setView changes a single kind without affecting the other", () => {
    useRulesChangesViewStore.getState().setView("core", "side");
    expect(useRulesChangesViewStore.getState().byKind).toEqual({
      core: "side",
      tournament: "off",
    });
    useRulesChangesViewStore.getState().setView("tournament", "inline");
    expect(useRulesChangesViewStore.getState().byKind).toEqual({
      core: "side",
      tournament: "inline",
    });
  });

  it("reset returns to defaults", () => {
    useRulesChangesViewStore.getState().setView("core", "inline");
    useRulesChangesViewStore.getState().reset();
    expect(useRulesChangesViewStore.getState().byKind.core).toBe("off");
  });
});

describe("isRulesChangesView", () => {
  it("accepts only the three views", () => {
    expect(isRulesChangesView("off")).toBe(true);
    expect(isRulesChangesView("inline")).toBe(true);
    expect(isRulesChangesView("side")).toBe(true);
    expect(isRulesChangesView("on")).toBe(false);
    expect(isRulesChangesView(true)).toBe(false);
  });
});
