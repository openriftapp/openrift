import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import { useInfractionsOpenStore } from "./infractions-open-store";

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useInfractionsOpenStore);
});

afterEach(() => {
  resetStore();
});

const openRules = () => [...useInfractionsOpenStore.getState().openRules];

describe("useInfractionsOpenStore", () => {
  it("starts with every row closed", () => {
    expect(openRules()).toEqual([]);
  });

  it("toggles one row open and closed", () => {
    useInfractionsOpenStore.getState().toggle("702.2");
    expect(openRules()).toEqual(["702.2"]);
    useInfractionsOpenStore.getState().toggle("702.2");
    expect(openRules()).toEqual([]);
  });

  it("opens the given rows and keeps the ones already open", () => {
    useInfractionsOpenStore.getState().toggle("702.1");
    useInfractionsOpenStore.getState().openAll(["702.2", "702.3"]);
    expect(openRules()).toEqual(["702.1", "702.2", "702.3"]);
  });

  it("closes every row, keeping the same state object when none is open", () => {
    const before = useInfractionsOpenStore.getState();
    useInfractionsOpenStore.getState().closeAll();
    expect(useInfractionsOpenStore.getState()).toBe(before);
    useInfractionsOpenStore.getState().openAll(["702.2"]);
    useInfractionsOpenStore.getState().closeAll();
    expect(openRules()).toEqual([]);
  });
});
