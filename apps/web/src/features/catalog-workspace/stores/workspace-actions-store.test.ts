import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import { registrationIsStale, useWorkspaceActionsStore } from "./workspace-actions-store";

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

describe("registrationIsStale", () => {
  const stale = () => registrationIsStale(useWorkspaceActionsStore.getState());

  it("holds the leaving record's actions stale, even when it registers again", () => {
    const leaving = Symbol("leaving");
    useWorkspaceActionsStore.getState().register({ ignore: () => {} }, leaving);
    expect(stale()).toBe(false);

    useWorkspaceActionsStore.getState().leave(false);
    expect(stale()).toBe(true);
    useWorkspaceActionsStore.getState().register({ ignore: () => {} }, leaving);
    expect(stale()).toBe(true);
  });

  it("stays stale after the leaving record unmounts until the next record registers", () => {
    const leaving = Symbol("leaving");
    useWorkspaceActionsStore.getState().register({}, leaving);
    useWorkspaceActionsStore.getState().leave(false);
    useWorkspaceActionsStore.getState().unregister(leaving);
    expect(stale()).toBe(true);

    useWorkspaceActionsStore.getState().register({}, Symbol("next"));
    expect(stale()).toBe(false);
  });

  it("is not stale on the list once the leaving record is gone", () => {
    const leaving = Symbol("leaving");
    useWorkspaceActionsStore.getState().register({}, leaving);
    useWorkspaceActionsStore.getState().leave(true);
    expect(stale()).toBe(true);

    useWorkspaceActionsStore.getState().unregister(leaving);
    expect(stale()).toBe(false);
  });

  it("stays stale while the next record registers as loading, until it registers loaded", () => {
    const leaving = Symbol("leaving");
    const next = Symbol("next");
    useWorkspaceActionsStore.getState().register({ ignore: () => {} }, leaving);
    useWorkspaceActionsStore.getState().leave(false);

    useWorkspaceActionsStore.getState().register({ loading: true }, next);
    expect(stale()).toBe(true);
    useWorkspaceActionsStore.getState().register({ ignore: () => {} }, next);
    expect(stale()).toBe(false);
  });

  it("is stale for a record opened directly while it loads", () => {
    useWorkspaceActionsStore.getState().register({ loading: true }, Symbol("record"));
    expect(stale()).toBe(true);
  });
});
