import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import type { PageTocStore } from "./page-toc-store";
import { createPageTocStore, PageTocStoreContext, usePageTocStore } from "./page-toc-store";

let store: PageTocStore;

beforeEach(() => {
  store = createPageTocStore();
});

describe("createPageTocStore", () => {
  it("starts with no active id", () => {
    expect(store.getState().activeId).toBeNull();
  });

  it("setActiveId updates the id", () => {
    store.getState().setActiveId("rule-103");
    expect(store.getState().activeId).toBe("rule-103");
  });

  it("setActiveId accepts null to clear the id", () => {
    store.getState().setActiveId("rule-103");
    store.getState().setActiveId(null);
    expect(store.getState().activeId).toBeNull();
  });

  it("setActiveId is a no-op when the id is unchanged (preserves state reference)", () => {
    store.getState().setActiveId("rule-103");
    const before = store.getState();
    store.getState().setActiveId("rule-103");
    expect(store.getState()).toBe(before);
  });

  it("a held selection makes setActiveId a no-op until released", () => {
    store.getState().selectActiveId("rule-103", true);
    store.getState().setActiveId("rule-104");
    expect(store.getState().activeId).toBe("rule-103");

    store.getState().releaseHold("rule-103");
    store.getState().setActiveId("rule-104");
    expect(store.getState().activeId).toBe("rule-104");
  });

  it("an unheld selection leaves setActiveId working", () => {
    store.getState().selectActiveId("rule-103", false);
    store.getState().setActiveId("rule-104");
    expect(store.getState().activeId).toBe("rule-104");
  });

  it("a new selection replaces an earlier hold", () => {
    store.getState().selectActiveId("rule-103", true);
    store.getState().selectActiveId("rule-104", false);
    expect(store.getState().heldId).toBeNull();
    expect(store.getState().activeId).toBe("rule-104");
  });

  it("releaseHold for another id keeps the current hold", () => {
    store.getState().selectActiveId("rule-104", true);
    store.getState().releaseHold("rule-103");
    expect(store.getState().heldId).toBe("rule-104");
  });

  it("releaseHold without an id clears any hold", () => {
    store.getState().selectActiveId("rule-104", true);
    store.getState().releaseHold();
    expect(store.getState().heldId).toBeNull();
  });

  it("keeps separate stores apart", () => {
    const other = createPageTocStore();
    store.getState().selectActiveId("rule-103", true);
    expect(other.getState().activeId).toBeNull();
    expect(other.getState().heldId).toBeNull();
  });
});

describe("usePageTocStore", () => {
  it("reads the store from the nearest provider", () => {
    store.getState().setActiveId("rule-200");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PageTocStoreContext value={store}>{children}</PageTocStoreContext>
    );
    const { result } = renderHook(() => usePageTocStore((state) => state.activeId), { wrapper });
    expect(result.current).toBe("rule-200");
  });

  it("throws without a provider", () => {
    expect(() => renderHook(() => usePageTocStore((state) => state.activeId))).toThrow(
      "usePageTocStore needs a PageTocProvider",
    );
  });
});
