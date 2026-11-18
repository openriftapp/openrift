import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetWorkspaceWriteQueue,
  workspaceWriteQueue,
} from "@/features/catalog-workspace/lib/workspace-write-queue";
import { useWorkspaceActionsStore } from "@/features/catalog-workspace/stores/workspace-actions-store";
import { createStoreResetter } from "@/test/store-helpers";

import { queuedWorkspaceWrite, queueWorkspaceWrite } from "./workspace-writes";

let resetActions: () => void;

beforeEach(() => {
  resetActions = createStoreResetter(useWorkspaceActionsStore);
});

afterEach(() => {
  resetActions();
  resetWorkspaceWriteQueue();
});

describe("queueWorkspaceWrite", () => {
  it("holds the registered record while the write waits behind an earlier one", async () => {
    const record = Symbol("record");
    useWorkspaceActionsStore.getState().register({}, record);
    const gate = { open: () => {} };
    const earlier = workspaceWriteQueue().enqueue(
      null,
      () =>
        new Promise<void>((resolve) => {
          gate.open = resolve;
        }),
    );
    const write = vi.fn();

    const queued = queueWorkspaceWrite(write);
    await vi.waitFor(() => expect(workspaceWriteQueue().holds(record)).toBe(true));
    expect(write).not.toHaveBeenCalled();
    gate.open();

    await earlier;
    expect(await queued).toBe(true);
    expect(write).toHaveBeenCalledOnce();
  });

  it("resolves false when the write throws", async () => {
    expect(await queueWorkspaceWrite(() => Promise.reject(new Error("Network down")))).toBe(false);
  });
});

describe("queuedWorkspaceWrite", () => {
  it("passes each call's arguments through the queue", async () => {
    const write = vi.fn((id: string, count: number) => `${id}:${count}`);
    const queued = queuedWorkspaceWrite(write);

    expect(await queued("ekko", 2)).toBe(true);
    expect(write).toHaveBeenCalledWith("ekko", 2);
  });
});
