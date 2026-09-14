// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { runTradeSettlement as RunTradeSettlement } from "./trade-settlement-request";

let runTradeSettlement: typeof RunTradeSettlement;

describe("runTradeSettlement", () => {
  beforeEach(async () => {
    sessionStorage.clear();
    vi.resetModules();
    ({ runTradeSettlement } = await import("./trade-settlement-request"));
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(["getItem", "setItem", "removeItem"] as const)(
    "still settles and starts a new action when storage %s throws",
    async (method) => {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new DOMException("Storage blocked", "SecurityError");
      });
      const send = vi.fn(async (_id: string) => "settled");
      const input = { tradeId: "trade-1", quantity: 1 };
      await expect(runTradeSettlement("user-1", "apply", input, send)).resolves.toBe("settled");
      await expect(runTradeSettlement("user-1", "apply", input, send)).resolves.toBe("settled");
      expect(send.mock.calls[0]![0]).not.toBe(send.mock.calls[1]![0]);
    },
  );

  it("retries with the same id when the sessionStorage getter is blocked", async () => {
    vi.spyOn(globalThis, "sessionStorage", "get").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });
    const send = vi
      .fn<(id: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error("Response lost"))
      .mockResolvedValue("settled");
    const input = { tradeId: "trade-1", quantity: 1 };
    await expect(runTradeSettlement("user-1", "skip", input, send)).rejects.toThrow(
      "Response lost",
    );
    await expect(runTradeSettlement("user-1", "skip", input, send)).resolves.toBe("settled");
    expect(send.mock.calls[0]![0]).toBe(send.mock.calls[1]![0]);
  });

  it("recovers the pending id after a reload when persistence is available", async () => {
    const input = { tradeId: "trade-1", quantity: 1 };
    const send = vi
      .fn<(id: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error("Response lost"))
      .mockResolvedValue("settled");
    await expect(runTradeSettlement("user-1", "apply", input, send)).rejects.toThrow(
      "Response lost",
    );
    vi.resetModules();
    const reloaded = await import("./trade-settlement-request");
    await reloaded.runTradeSettlement("user-1", "apply", input, send);
    expect(send.mock.calls[0]![0]).toBe(send.mock.calls[1]![0]);
  });

  it("reuses the request after a lost response and creates a new one after success", async () => {
    const input = { tradeId: "trade-1", quantity: 1 };
    const send = vi
      .fn<(id: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error("Response lost"))
      .mockResolvedValue("settled");
    await expect(runTradeSettlement("user-1", "apply", input, send)).rejects.toThrow(
      "Response lost",
    );
    await runTradeSettlement("user-1", "apply", input, send);
    await runTradeSettlement("user-1", "apply", input, send);
    expect(send.mock.calls[1]![0]).toBe(send.mock.calls[0]![0]);
    expect(send.mock.calls[2]![0]).not.toBe(send.mock.calls[0]![0]);
  });

  it("keeps user, trade, action and payload identities separate", async () => {
    const send = vi.fn(async (_id: string) => {
      throw new Error("Response lost");
    });
    const input = { tradeId: "trade-1", quantity: 1 };
    for (const [userId, action, data] of [
      ["user-1", "apply", input],
      ["user-2", "apply", input],
      ["user-1", "skip", input],
      ["user-1", "apply", { ...input, tradeId: "trade-2" }],
      ["user-1", "apply", { ...input, quantity: 2 }],
    ] as const) {
      await expect(runTradeSettlement(userId, action, data, send)).rejects.toThrow("Response lost");
    }
    expect(new Set(send.mock.calls.map(([id]) => id)).size).toBe(5);
  });

  it("reuses an outstanding request across simultaneous submissions", async () => {
    const send = vi.fn(async (_id: string) => "settled");
    const input = { tradeId: "trade-1", quantity: 1 };
    const first = runTradeSettlement("user-1", "skip", input, send);
    const second = runTradeSettlement("user-1", "skip", input, send);
    expect(send.mock.calls[0]![0]).toBe(send.mock.calls[1]![0]);
    await Promise.all([first, second]);
  });
});
