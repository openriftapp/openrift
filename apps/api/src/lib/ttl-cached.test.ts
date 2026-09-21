import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ttlCached } from "./ttl-cached";

describe("ttlCached", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("serves the loaded value until the ttl runs out, then loads again", async () => {
    const load = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const get = ttlCached(1000, load);

    expect(await get()).toBe(1);
    vi.advanceTimersByTime(999);
    expect(await get()).toBe(1);
    vi.advanceTimersByTime(1);
    expect(await get()).toBe(2);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one load between concurrent callers", async () => {
    const load = vi.fn().mockResolvedValue(7);
    const get = ttlCached(1000, load);

    expect(await Promise.all([get(), get(), get()])).toEqual([7, 7, 7]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("keeps no failed load, so the next call retries", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(3);
    const get = ttlCached(1000, load);

    await expect(get()).rejects.toThrow("down");
    expect(await get()).toBe(3);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
