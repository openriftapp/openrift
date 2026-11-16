import { describe, expect, it } from "vitest";

import { createRulesPageStore, isFoldShut } from "./rules-page-store";

const NONE: ReadonlySet<string> = new Set();

describe("createRulesPageStore", () => {
  it("starts with nothing folded and no examples open", () => {
    const state = createRulesPageStore().getState();
    expect(state.folds.size).toBe(0);
    expect(state.expandedExamples.size).toBe(0);
  });

  it("gives each page its own fold state", () => {
    createRulesPageStore().getState().setFolded("103", true, "");
    expect(createRulesPageStore().getState().folds.size).toBe(0);
  });

  it("records the hash a fold was made under and removes it on unfold", () => {
    const store = createRulesPageStore();
    store.getState().setFolded("103", true, "rule-200");
    expect(store.getState().folds.get("103")).toBe("rule-200");
    store.getState().setFolded("103", false, "rule-200");
    expect(store.getState().folds.has("103")).toBe(false);
  });

  it("unfolds the given rules and keeps the state object when none is folded", () => {
    const store = createRulesPageStore();
    const before = store.getState();
    store.getState().unfold(["103"]);
    expect(store.getState()).toBe(before);
    store.getState().setFolded("103", true, "");
    store.getState().setFolded("104", true, "");
    store.getState().unfold(["103"]);
    expect([...store.getState().folds.keys()]).toEqual(["104"]);
  });

  it("toggles a rule's examples open and closed", () => {
    const store = createRulesPageStore();
    store.getState().toggleExamples("100.1");
    expect(store.getState().expandedExamples.has("100.1")).toBe(true);
    store.getState().toggleExamples("100.1");
    expect(store.getState().expandedExamples.has("100.1")).toBe(false);
  });
});

describe("isFoldShut", () => {
  const folds = new Map([["103", "rule-200"]]);

  it("is open for a rule that is not folded", () => {
    expect(isFoldShut(folds, "104", "", NONE)).toBe(false);
  });

  it("is shut for a folded rule the hash does not reveal", () => {
    expect(isFoldShut(folds, "103", "rule-103.1", NONE)).toBe(true);
  });

  it("opens a folded rule that a later hash jump reveals", () => {
    expect(isFoldShut(folds, "103", "rule-103.1", new Set(["103"]))).toBe(false);
  });

  it("stays shut when the fold was made under the current hash", () => {
    expect(isFoldShut(folds, "103", "rule-200", new Set(["103"]))).toBe(true);
  });
});
