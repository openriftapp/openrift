import { describe, expect, it } from "vitest";

import { createWorkspaceWriteQueue } from "./workspace-write-queue";

function deferred() {
  let settle = () => {};
  const promise = new Promise<void>((resolve) => {
    settle = resolve;
  });
  return { promise, resolve: () => settle() };
}

describe("createWorkspaceWriteQueue", () => {
  it("runs tasks one at a time in the order they were queued", async () => {
    const queue = createWorkspaceWriteQueue();
    const first = deferred();
    const order: string[] = [];
    const a = queue.enqueue(Symbol("a"), async () => {
      order.push("a start");
      await first.promise;
      order.push("a end");
    });
    const b = queue.enqueue(Symbol("b"), () => {
      order.push("b");
    });
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
    const done = queue.enqueue(record, () => write.promise);
    expect(queue.holds(record)).toBe(true);
    expect(queue.holds(Symbol("other"))).toBe(false);
    expect(queue.idle()).toBe(false);
    write.resolve();
    await done;
    expect(queue.holds(record)).toBe(false);
    expect(queue.idle()).toBe(true);
  });

  it("keeps running after a task fails and resolves that task false", async () => {
    const queue = createWorkspaceWriteQueue();
    const failed = queue.enqueue(null, () => Promise.reject(new Error("nope")));
    const next = queue.enqueue(null, () => {});
    expect(await failed).toBe(false);
    expect(await next).toBe(true);
    expect(queue.idle()).toBe(true);
  });
});
