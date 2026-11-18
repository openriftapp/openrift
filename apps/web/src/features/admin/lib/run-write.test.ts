import { describe, expect, it, vi } from "vitest";

import { runWriteDirectly } from "./run-write";

describe("runWriteDirectly", () => {
  it("runs the write at once with no signal and resolves true when it lands", async () => {
    const write = vi.fn(async (_signal?: AbortSignal) => "saved");

    await expect(runWriteDirectly(write)).resolves.toBe(true);
    expect(write).toHaveBeenCalledWith();
  });

  it("resolves false when the write rejects", async () => {
    await expect(runWriteDirectly(() => Promise.reject(new Error("conflict")))).resolves.toBe(
      false,
    );
  });
});
