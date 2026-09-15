import { describe, expect, it } from "vitest";

import { createEventLoopYielder } from "./event-loop-yield.js";

describe("createEventLoopYielder", () => {
  it("stays on the current task while under budget", async () => {
    let clock = 0;
    const yieldIfBusy = createEventLoopYielder(10, () => clock);
    let macrotaskRan = false;
    setImmediate(() => {
      macrotaskRan = true;
    });

    clock = 9;
    await yieldIfBusy();

    expect(macrotaskRan).toBe(false);
  });

  it("lets queued macrotasks run once the budget is spent, then starts a new slice", async () => {
    let clock = 0;
    const yieldIfBusy = createEventLoopYielder(10, () => clock);
    let macrotasks = 0;
    setImmediate(() => {
      macrotasks++;
    });

    clock = 10;
    await yieldIfBusy();
    expect(macrotasks).toBe(1);

    setImmediate(() => {
      macrotasks++;
    });
    clock = 15;
    await yieldIfBusy();
    expect(macrotasks).toBe(1);
  });
});
