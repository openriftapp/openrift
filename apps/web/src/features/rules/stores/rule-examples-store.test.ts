import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import { useRuleExamplesStore } from "./rule-examples-store";

describe("rule-examples-store", () => {
  let resetStore: () => void;

  beforeEach(() => {
    resetStore = createStoreResetter(useRuleExamplesStore);
  });

  afterEach(() => {
    resetStore();
  });

  it("starts with no examples and nothing expanded", () => {
    const state = useRuleExamplesStore.getState();
    expect(state.examplesByRule.size).toBe(0);
    expect(state.expandedRules.size).toBe(0);
  });

  it("setExamplesByRule replaces the map and clears expanded rules", () => {
    const { toggle, setExamplesByRule } = useRuleExamplesStore.getState();
    toggle("100.1");
    setExamplesByRule(
      new Map([["100.1", [{ shareToken: "tok", title: "Example", answer: null }]]]),
    );
    const state = useRuleExamplesStore.getState();
    expect(state.examplesByRule.get("100.1")).toHaveLength(1);
    expect(state.expandedRules.size).toBe(0);
  });

  it("toggle adds a rule when not expanded, removes when expanded", () => {
    const { toggle } = useRuleExamplesStore.getState();
    toggle("100.1");
    expect(useRuleExamplesStore.getState().expandedRules.has("100.1")).toBe(true);
    toggle("100.1");
    expect(useRuleExamplesStore.getState().expandedRules.has("100.1")).toBe(false);
  });

  it("toggle is independent across rules", () => {
    const { toggle } = useRuleExamplesStore.getState();
    toggle("100.1");
    toggle("200.5");
    const expanded = useRuleExamplesStore.getState().expandedRules;
    expect(expanded.has("100.1")).toBe(true);
    expect(expanded.has("200.5")).toBe(true);
    expect(expanded.size).toBe(2);
  });
});
