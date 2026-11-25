import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { WorkspaceRecordActions } from "@/features/catalog-workspace/stores/workspace-actions-store";
import { useWorkspaceActionsStore } from "@/features/catalog-workspace/stores/workspace-actions-store";
import { createStoreResetter } from "@/test/store-helpers";

import { useRegisterRecordActions } from "./use-register-record-actions";

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useWorkspaceActionsStore);
});

afterEach(() => {
  resetStore();
});

describe("useRegisterRecordActions", () => {
  it("publishes the latest actions on every render", () => {
    const first: WorkspaceRecordActions = { accept: () => {} };
    const second: WorkspaceRecordActions = { ignore: () => {} };
    const { rerender } = renderHook(
      (actions: WorkspaceRecordActions) => useRegisterRecordActions(actions),
      {
        initialProps: first,
      },
    );
    expect(useWorkspaceActionsStore.getState().actions).toBe(first);
    rerender(second);
    expect(useWorkspaceActionsStore.getState().actions).toBe(second);
  });

  it("clears the actions when the record unmounts", () => {
    const { unmount } = renderHook(() => useRegisterRecordActions({ accept: () => {} }));
    unmount();
    expect(useWorkspaceActionsStore.getState().actions).toBeNull();
  });

  it("keeps a newer record's actions when an older one unmounts", () => {
    const older = renderHook(() => useRegisterRecordActions({ accept: () => {} }));
    const newer: WorkspaceRecordActions = { ignore: () => {} };
    renderHook(() => useRegisterRecordActions(newer));
    older.unmount();
    expect(useWorkspaceActionsStore.getState().actions).toBe(newer);
  });
});
