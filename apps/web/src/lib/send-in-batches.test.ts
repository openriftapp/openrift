import { describe, expect, it, vi } from "vitest";

import { sendInBatches } from "./send-in-batches";

describe("sendInBatches", () => {
  it("sends the items in order, one batch at a time", async () => {
    const sent: number[][] = [];
    let inFlight = 0;
    await sendInBatches([1, 2, 3, 4, 5], 2, async (batch) => {
      inFlight++;
      expect(inFlight).toBe(1);
      await Promise.resolve();
      sent.push(batch);
      inFlight--;
    });
    expect(sent).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("sends nothing for an empty list", async () => {
    const send = vi.fn(async () => {});
    await sendInBatches([], 10, send);
    expect(send).not.toHaveBeenCalled();
  });

  it("stops at the first rejected batch", async () => {
    const send = vi.fn(async (batch: number[]) => {
      if (batch[0] === 3) {
        throw new Error("boom");
      }
    });
    await expect(sendInBatches([1, 2, 3, 4, 5], 2, send)).rejects.toThrow("boom");
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("rejects a non-positive batch size", async () => {
    await expect(sendInBatches([1], 0, async () => {})).rejects.toThrow(RangeError);
  });
});
