import { describe, expect, it } from "vitest";

import { createInfractionsOpenStore } from "./infractions-open-store";

describe("createInfractionsOpenStore", () => {
  it("starts with every row closed", () => {
    expect([...createInfractionsOpenStore().getState().openRules]).toEqual([]);
  });

  it("gives each page its own open rows", () => {
    createInfractionsOpenStore().getState().toggle("702.2");
    expect([...createInfractionsOpenStore().getState().openRules]).toEqual([]);
  });

  it("toggles one row open and closed", () => {
    const store = createInfractionsOpenStore();
    store.getState().toggle("702.2");
    expect([...store.getState().openRules]).toEqual(["702.2"]);
    store.getState().toggle("702.2");
    expect([...store.getState().openRules]).toEqual([]);
  });

  it("opens the given rows and keeps the ones already open", () => {
    const store = createInfractionsOpenStore();
    store.getState().toggle("702.1");
    store.getState().openAll(["702.2", "702.3"]);
    expect([...store.getState().openRules]).toEqual(["702.1", "702.2", "702.3"]);
  });

  it("closes every row, keeping the same state object when none is open", () => {
    const store = createInfractionsOpenStore();
    const before = store.getState();
    store.getState().closeAll();
    expect(store.getState()).toBe(before);
    store.getState().openAll(["702.2"]);
    store.getState().closeAll();
    expect([...store.getState().openRules]).toEqual([]);
  });
});
