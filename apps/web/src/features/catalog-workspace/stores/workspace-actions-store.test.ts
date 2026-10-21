import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import { useWorkspaceActionsStore } from "./workspace-actions-store";

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useWorkspaceActionsStore);
});

afterEach(() => {
  resetStore();
});

describe("useWorkspaceActionsStore", () => {
  it("holds the actions of the record that registered last", () => {
    const first = Symbol("first");
    const second = Symbol("second");
    const secondActions = { accept: () => {} };
    useWorkspaceActionsStore.getState().register({ ignore: () => {} }, first);
    useWorkspaceActionsStore.getState().register(secondActions, second);
    expect(useWorkspaceActionsStore.getState().actions).toBe(secondActions);
  });

  it("ignores an unregister from a record that no longer owns the actions", () => {
    const first = Symbol("first");
    const second = Symbol("second");
    const secondActions = { accept: () => {} };
    useWorkspaceActionsStore.getState().register({}, first);
    useWorkspaceActionsStore.getState().register(secondActions, second);
    useWorkspaceActionsStore.getState().unregister(first);
    expect(useWorkspaceActionsStore.getState().actions).toBe(secondActions);
    useWorkspaceActionsStore.getState().unregister(second);
    expect(useWorkspaceActionsStore.getState().actions).toBeNull();
  });
});
