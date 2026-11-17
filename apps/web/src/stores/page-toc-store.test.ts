import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import { usePageTocStore } from "./page-toc-store";

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(usePageTocStore);
});

afterEach(() => {
  resetStore();
});

describe("usePageTocStore", () => {
  it("starts with no active id", () => {
    expect(usePageTocStore.getState().activeId).toBeNull();
  });

  it("setActiveId updates the id", () => {
    usePageTocStore.getState().setActiveId("rule-103");
    expect(usePageTocStore.getState().activeId).toBe("rule-103");
  });

  it("setActiveId accepts null to clear the id", () => {
    usePageTocStore.getState().setActiveId("rule-103");
    usePageTocStore.getState().setActiveId(null);
    expect(usePageTocStore.getState().activeId).toBeNull();
  });

  it("setActiveId is a no-op when the id is unchanged (preserves state reference)", () => {
    usePageTocStore.getState().setActiveId("rule-103");
    const before = usePageTocStore.getState();
    usePageTocStore.getState().setActiveId("rule-103");
    const after = usePageTocStore.getState();
    expect(after).toBe(before);
  });

  it("a held selection makes setActiveId a no-op until released", () => {
    usePageTocStore.getState().selectActiveId("rule-103", true);
    usePageTocStore.getState().setActiveId("rule-104");
    expect(usePageTocStore.getState().activeId).toBe("rule-103");

    usePageTocStore.getState().releaseHold("rule-103");
    usePageTocStore.getState().setActiveId("rule-104");
    expect(usePageTocStore.getState().activeId).toBe("rule-104");
  });

  it("an unheld selection leaves setActiveId working", () => {
    usePageTocStore.getState().selectActiveId("rule-103", false);
    usePageTocStore.getState().setActiveId("rule-104");
    expect(usePageTocStore.getState().activeId).toBe("rule-104");
  });

  it("a new selection replaces an earlier hold", () => {
    usePageTocStore.getState().selectActiveId("rule-103", true);
    usePageTocStore.getState().selectActiveId("rule-104", false);
    expect(usePageTocStore.getState().heldId).toBeNull();
    expect(usePageTocStore.getState().activeId).toBe("rule-104");
  });

  it("releaseHold for another id keeps the current hold", () => {
    usePageTocStore.getState().selectActiveId("rule-104", true);
    usePageTocStore.getState().releaseHold("rule-103");
    expect(usePageTocStore.getState().heldId).toBe("rule-104");
  });

  it("releaseHold without an id clears any hold", () => {
    usePageTocStore.getState().selectActiveId("rule-104", true);
    usePageTocStore.getState().releaseHold();
    expect(usePageTocStore.getState().heldId).toBeNull();
  });
});
