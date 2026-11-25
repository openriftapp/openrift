import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetWorkspaceWriteQueue,
  workspaceWriteQueue,
} from "@/features/catalog-workspace/lib/workspace-write-queue";
import { useWorkspaceActionsStore } from "@/features/catalog-workspace/stores/workspace-actions-store";
import { createStoreResetter } from "@/test/store-helpers";

import { queuedFieldWrite, queueWorkspaceWrite } from "./workspace-writes";

let resetActions: () => void;
const queryClient = new QueryClient();

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
      { queryClient },
    );
    const write = vi.fn();

    const queued = queueWorkspaceWrite(queryClient, write);
    await vi.waitFor(() => expect(workspaceWriteQueue().holds(record)).toBe(true));
    expect(write).not.toHaveBeenCalled();
    gate.open();

    await earlier;
    expect(await queued).toBe(true);
    expect(write).toHaveBeenCalledOnce();
  });

  it("resolves false when the write throws", async () => {
    expect(
      await queueWorkspaceWrite(queryClient, () => Promise.reject(new Error("Network down"))),
    ).toBe(false);
  });
});

describe("queuedFieldWrite", () => {
  it("passes the task's signal, the call's mark and its arguments through the queue", async () => {
    const write = vi.fn(
      (_signal: AbortSignal, _mark: unknown, id: string, count: number) => `${id}:${count}`,
    );
    const queued = queuedFieldWrite(
      (task, options) => queueWorkspaceWrite(queryClient, task, options),
      write,
    );

    expect(await queued("ekko", 2)).toBe(true);
    expect(write).toHaveBeenCalledWith(
      expect.any(AbortSignal),
      { write: expect.any(Number) },
      "ekko",
      2,
    );
  });
});
