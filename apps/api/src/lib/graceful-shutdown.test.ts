import { createLogger } from "@openrift/shared/logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { gracefulShutdown } from "./graceful-shutdown";

const log = createLogger("test", "silent");

describe("gracefulShutdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs the steps in order, then exits 0", async () => {
    const calls: string[] = [];
    const exit = vi.fn((code: number) => calls.push(`exit ${code}`));
    const shutdown = gracefulShutdown({
      steps: [
        { name: "server", run: async () => void calls.push("server") },
        { name: "db", run: () => void calls.push("db") },
      ],
      deadlineMs: 1000,
      log,
      exit,
    });

    await shutdown("SIGTERM");

    expect(calls).toEqual(["server", "db", "exit 0"]);
  });

  it("runs once when a second signal arrives mid-shutdown", async () => {
    const step = vi.fn(async () => {});
    const exit = vi.fn();
    const shutdown = gracefulShutdown({
      steps: [{ name: "db", run: step }],
      deadlineMs: 1000,
      log,
      exit,
    });

    await Promise.all([shutdown("SIGTERM"), shutdown("SIGINT")]);

    expect(step).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("keeps going after a failing step", async () => {
    const after = vi.fn();
    const exit = vi.fn();
    const shutdown = gracefulShutdown({
      steps: [
        {
          name: "server",
          run: () => {
            throw new Error("already stopped");
          },
        },
        { name: "db", run: after },
      ],
      deadlineMs: 1000,
      log,
      exit,
    });

    await shutdown("SIGTERM");

    expect(after).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("exits 1 at the deadline when a step hangs, and never exits twice", async () => {
    const { promise: hang, resolve } = Promise.withResolvers<void>();
    const exit = vi.fn();
    const shutdown = gracefulShutdown({
      steps: [{ name: "db", run: () => hang }],
      deadlineMs: 1000,
      log,
      exit,
    });

    const done = shutdown("SIGTERM");
    await vi.advanceTimersByTimeAsync(999);
    expect(exit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(exit).toHaveBeenCalledWith(1);

    resolve();
    await done;
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
