// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import { useWorkspaceSkipStore } from "./workspace-skip-store";

const STORAGE_KEY = "catalog-workspace-skipped";

let resetStore: () => void;

beforeEach(() => {
  localStorage.clear();
  resetStore = createStoreResetter(useWorkspaceSkipStore);
});

afterEach(() => {
  resetStore();
  localStorage.clear();
});

describe("useWorkspaceSkipStore", () => {
  it("keeps skips per owner in skip order and moves a repeat skip to the end", () => {
    const { skip } = useWorkspaceSkipStore.getState();
    skip("card", "card:jinx-loose-cannon");
    skip("card", "card:yasuo-unforgiven");
    skip("face", "face:f1");
    skip("card", "card:jinx-loose-cannon");
    expect(useWorkspaceSkipStore.getState().skipped).toEqual({
      card: ["card:yasuo-unforgiven", "card:jinx-loose-cannon"],
      face: ["face:f1"],
    });
  });

  it("writes the skips to localStorage", () => {
    useWorkspaceSkipStore.getState().skip("printing", "printing:p1");
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as {
      state?: unknown;
    };
    expect(stored.state).toEqual({ skipped: { printing: ["printing:p1"] } });
  });

  it("prunes keys that left the queue and leaves other owners alone", () => {
    const { skip, prune } = useWorkspaceSkipStore.getState();
    skip("card", "card:a");
    skip("card", "card:b");
    skip("face", "face:f1");
    prune("card", new Set(["card:b", "card:c"]));
    expect(useWorkspaceSkipStore.getState().skipped).toEqual({
      card: ["card:b"],
      face: ["face:f1"],
    });
  });

  it("does not rewrite the state when nothing is pruned", () => {
    useWorkspaceSkipStore.getState().skip("card", "card:a");
    const before = useWorkspaceSkipStore.getState().skipped;
    useWorkspaceSkipStore.getState().prune("card", new Set(["card:a"]));
    expect(useWorkspaceSkipStore.getState().skipped).toBe(before);
  });

  it("clears one owner", () => {
    const { skip, clearSkipped } = useWorkspaceSkipStore.getState();
    skip("card", "card:a");
    skip("face", "face:f1");
    clearSkipped("card");
    expect(useWorkspaceSkipStore.getState().skipped).toEqual({ card: [], face: ["face:f1"] });
  });

  it("restores the skips from storage", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { skipped: { face: ["face:f1", "face:f2"] } }, version: 0 }),
    );
    await useWorkspaceSkipStore.persist.rehydrate();
    expect(useWorkspaceSkipStore.getState().skipped).toEqual({ face: ["face:f1", "face:f2"] });
  });

  it("drops malformed and unknown entries on rehydrate", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { skipped: { card: ["card:a", 3, "card:a"], deck: ["x"], face: "face:f1" } },
        version: 0,
      }),
    );
    await useWorkspaceSkipStore.persist.rehydrate();
    expect(useWorkspaceSkipStore.getState().skipped).toEqual({ card: ["card:a"] });
  });

  it("falls back to no skips for a corrupt blob", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: null, version: 0 }));
    await useWorkspaceSkipStore.persist.rehydrate();
    expect(useWorkspaceSkipStore.getState().skipped).toEqual({});
  });
});
