import { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runReportedMutation } from "@/lib/run-reported-mutation";
import { withWriteSignal } from "@/lib/write-signal";

import {
  createWorkspaceWriteQueue,
  LONG_TIMED_OUT_NOTICE,
  LONG_TIMEOUT_MS,
  RELOAD_TIMEOUT_MS,
  UPLOAD_TIMED_OUT_NOTICE,
  WRITE_TIMED_OUT_NOTICE,
  WRITE_TIMEOUT_MS,
} from "./workspace-write-queue";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
});

function deferred() {
  let settle = () => {};
  const promise = new Promise<void>((resolve) => {
    settle = resolve;
  });
  return { promise, resolve: () => settle() };
}

/** A queue whose signals abort only when the test aborts them, keyed by the limit each asked for. */
function controlledQueue() {
  const controllers: { ms: number; controller: AbortController }[] = [];
  const queue = createWorkspaceWriteQueue((ms) => {
    const controller = new AbortController();
    controllers.push({ ms, controller });
    return controller.signal;
  });
  return { queue, controllers };
}

const hanging = (signal: AbortSignal) =>
  new Promise<never>((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted", { cause: signal.reason })));
  });

describe("createWorkspaceWriteQueue", () => {
  const options = { queryClient: new QueryClient() };

  it("runs tasks one at a time in the order they were queued", async () => {
    const queue = createWorkspaceWriteQueue();
    const first = deferred();
    const order: string[] = [];
    const a = queue.enqueue(
      Symbol("a"),
      async () => {
        order.push("a start");
        await first.promise;
        order.push("a end");
      },
      options,
    );
    const b = queue.enqueue(
      Symbol("b"),
      () => {
        order.push("b");
      },
      options,
    );
    await Promise.resolve();
    expect(order).toEqual(["a start"]);
    first.resolve();
    expect(await a).toBe(true);
    expect(await b).toBe(true);
    expect(order).toEqual(["a start", "a end", "b"]);
  });

  it("tracks which records hold a write until their task settles", async () => {
    const queue = createWorkspaceWriteQueue();
    const record = Symbol("record");
    const write = deferred();
    expect(queue.idle()).toBe(true);
    const done = queue.enqueue(record, () => write.promise, options);
    expect(queue.holds(record)).toBe(true);
    expect(queue.holds(Symbol("other"))).toBe(false);
    expect(queue.idle()).toBe(false);
    write.resolve();
    await done;
    expect(queue.holds(record)).toBe(false);
    expect(queue.idle()).toBe(true);
  });

  it("says whether every queued write belongs to one record", async () => {
    const queue = createWorkspaceWriteQueue();
    const mine = Symbol("mine");
    expect(queue.holdsOnly(mine)).toBe(true);
    const write = deferred();
    const first = queue.enqueue(mine, () => write.promise, options);
    expect(queue.holdsOnly(mine)).toBe(true);
    const second = queue.enqueue(null, () => {}, options);
    expect(queue.holdsOnly(mine)).toBe(false);
    write.resolve();
    await Promise.all([first, second]);
    expect(queue.holdsOnly(null)).toBe(true);
  });

  it("hands each task its own signal with the write limit", async () => {
    const { queue, controllers } = controlledQueue();
    const signals: AbortSignal[] = [];
    await queue.enqueue(null, (signal) => signals.push(signal), options);
    await queue.enqueue(null, (signal) => signals.push(signal), options);
    expect(signals).toHaveLength(2);
    expect(signals[1]).not.toBe(signals[0]);
    expect(controllers.map(({ ms }) => ms)).toEqual([WRITE_TIMEOUT_MS, WRITE_TIMEOUT_MS]);
  });

  it("gives an upload task the upload limit and its own notice", async () => {
    const { queue, controllers } = controlledQueue();
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    const upload = queue.enqueue(null, hanging, { queryClient, limit: "upload" });
    await vi.waitFor(() => expect(controllers).toHaveLength(1));
    expect(controllers[0]?.ms).toBe(LONG_TIMEOUT_MS);
    controllers[0]?.controller.abort();

    expect(await upload).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(UPLOAD_TIMED_OUT_NOTICE, expect.anything());
  });

  it("gives a long task the long limit and the save notice", async () => {
    const { queue, controllers } = controlledQueue();
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    const batch = queue.enqueue(null, hanging, { queryClient, limit: "long" });
    await vi.waitFor(() => expect(controllers).toHaveLength(1));
    expect(controllers[0]?.ms).toBe(LONG_TIMEOUT_MS);
    controllers[0]?.controller.abort();

    expect(await batch).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(LONG_TIMED_OUT_NOTICE, expect.anything());
  });

  it("aborts a request with no answer, reloads, then frees the queue for the next write", async () => {
    const { queue, controllers } = controlledQueue();
    const queryClient = new QueryClient();
    const reload = deferred();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockReturnValue(reload.promise);
    const next = vi.fn();

    const stuck = queue.enqueue(
      null,
      (signal) => runReportedMutation(() => withWriteSignal(signal, () => hanging(signal))),
      { queryClient },
    );
    const after = queue.enqueue(null, next, { queryClient });
    await vi.waitFor(() => expect(controllers).toHaveLength(1));
    controllers[0]?.controller.abort();
    await vi.waitFor(() => expect(invalidate).toHaveBeenCalledOnce());
    expect(next).not.toHaveBeenCalled();
    reload.resolve();

    expect(await stuck).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(WRITE_TIMED_OUT_NOTICE, expect.anything());
    expect(await after).toBe(true);
    expect(next).toHaveBeenCalledOnce();
  });

  it("frees the queue when a task hangs in its refetch after the write landed", async () => {
    const { queue, controllers } = controlledQueue();
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    const refetch = deferred();
    const write = vi.fn(async () => "saved");
    const next = vi.fn();

    const hungRefetch = queue.enqueue(
      null,
      async () => {
        await write();
        await refetch.promise;
      },
      { queryClient },
    );
    const after = queue.enqueue(null, next, { queryClient });
    await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());
    expect(next).not.toHaveBeenCalled();
    controllers[0]?.controller.abort();

    expect(await hungRefetch).toBe(false);
    expect(await after).toBe(true);
    expect(next).toHaveBeenCalledOnce();
    expect(queue.idle()).toBe(true);
  });

  it("runs the next write once a hanging reload hits its own limit", async () => {
    const { queue, controllers } = controlledQueue();
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, "invalidateQueries").mockReturnValue(new Promise(() => {}));
    const next = vi.fn();

    const stuck = queue.enqueue(null, hanging, { queryClient });
    const after = queue.enqueue(null, next, { queryClient });
    await vi.waitFor(() => expect(controllers).toHaveLength(1));
    controllers[0]?.controller.abort();
    await vi.waitFor(() => expect(controllers).toHaveLength(2));
    expect(controllers[1]?.ms).toBe(RELOAD_TIMEOUT_MS);
    await Promise.resolve();
    expect(next).not.toHaveBeenCalled();
    controllers[1]?.controller.abort();

    expect(await stuck).toBe(false);
    expect(await after).toBe(true);
    expect(next).toHaveBeenCalledOnce();
  });

  it("tells the next task whether the one before it timed out", async () => {
    const { queue, controllers } = controlledQueue();
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    const seen: boolean[] = [];

    const stuck = queue.enqueue(null, hanging, { queryClient });
    const second = queue.enqueue(null, () => seen.push(queue.previousTimedOut()), { queryClient });
    const third = queue.enqueue(null, () => seen.push(queue.previousTimedOut()), { queryClient });
    await vi.waitFor(() => expect(controllers).toHaveLength(1));
    controllers[0]?.controller.abort();
    await Promise.all([stuck, second, third]);

    expect(seen).toEqual([true, false]);
  });

  it("keeps running after a task fails and resolves that task false", async () => {
    const queue = createWorkspaceWriteQueue();
    const failed = queue.enqueue(null, () => Promise.reject(new Error("nope")), options);
    const next = queue.enqueue(null, () => {}, options);
    expect(await failed).toBe(false);
    expect(await next).toBe(true);
    expect(queue.idle()).toBe(true);
  });
});
