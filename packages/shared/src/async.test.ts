import { afterEach, describe, expect, it, vi } from "vitest";

import { sleep } from "./async.js";

describe("sleep", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves only after the given delay", async () => {
    vi.useFakeTimers();
    const settled = vi.fn<() => void>();
    void sleep(1000).then(settled, settled);
    await vi.advanceTimersByTimeAsync(999);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toHaveBeenCalledOnce();
  });
});
