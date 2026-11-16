import type {
  CardTradeCopyOptionsResponse,
  CardTradeResponse,
  CardTradeRole,
} from "@openrift/shared/types/api/card-trade";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));

vi.mock("@/lib/toast", () => ({ PERSISTENT_ERROR_TOAST: {}, toastError }));
vi.mock("@/lib/stale-bundle-reload", () => ({
  isStaleServerFnError: (error: unknown) => error instanceof Error && error.message === "stale",
}));

const { readCopyOptionsReported, runSettleBatch } = await import("./trade-settle-batch");

function trade(id: string, role: CardTradeRole, quantity: number): CardTradeResponse {
  return { id, role, quantity, groupSlug: "friday-night" } as unknown as CardTradeResponse;
}

function options(choiceMatters: boolean): CardTradeCopyOptionsResponse {
  return { tradeId: "t", quantity: 1, choiceMatters, copies: [] } as CardTradeCopyOptionsResponse;
}

function deps(overrides: Partial<Parameters<typeof runSettleBatch>[1]> = {}) {
  return {
    settle: vi.fn(async () => undefined),
    readCopyOptions: vi.fn(async () => options(false)),
    ...overrides,
  };
}

describe("runSettleBatch", () => {
  it("settles each row for the quantity that turned up", async () => {
    const d = deps();
    await runSettleBatch(
      [
        { trade: trade("t1", "receiver", 3), quantity: 1 },
        { trade: trade("t2", "receiver", 2), quantity: 2 },
      ],
      d,
    );

    expect(d.settle).toHaveBeenCalledTimes(2);
    expect(d.settle).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ tradeId: "t1", quantity: 1 }),
    );
    expect(d.settle).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ tradeId: "t2", quantity: 2 }),
    );
  });

  it("reports which rows settled so their tally can be dropped", async () => {
    const d = deps();
    const result = await runSettleBatch(
      [
        { trade: trade("t1", "receiver", 1), quantity: 1 },
        { trade: trade("t2", "receiver", 1), quantity: 1 },
      ],
      d,
    );

    expect(result).toEqual({ pendingChoices: [], settledTradeIds: ["t1", "t2"], failed: false });
  });

  it("files the receiver's copies into the chosen collection", async () => {
    const d = deps();
    await runSettleBatch([{ trade: trade("t1", "receiver", 1), quantity: 1 }], {
      ...d,
      targetCollectionId: "col-7",
    });

    expect(d.settle).toHaveBeenCalledWith(expect.objectContaining({ targetCollectionId: "col-7" }));
  });

  it("never sends a target collection on the giver's side", async () => {
    const d = deps();
    await runSettleBatch([{ trade: trade("t1", "giver", 1), quantity: 1 }], {
      ...d,
      targetCollectionId: "col-7",
    });

    expect(d.settle).toHaveBeenCalledWith(
      expect.objectContaining({ targetCollectionId: undefined }),
    );
  });

  it("never reads copy options for the receiver", async () => {
    const d = deps();
    await runSettleBatch([{ trade: trade("t1", "receiver", 1), quantity: 1 }], d);

    expect(d.readCopyOptions).not.toHaveBeenCalled();
  });

  it("holds a giver's row back when the candidate copies differ", async () => {
    const held = trade("t1", "giver", 3);
    const d = deps({ readCopyOptions: vi.fn(async () => options(true)) });
    const result = await runSettleBatch([{ trade: held, quantity: 2 }], d);

    expect(d.settle).not.toHaveBeenCalled();
    expect(result.pendingChoices).toEqual([{ trade: held, quantity: 2, options: options(true) }]);
    expect(result.settledTradeIds).toEqual([]);
  });

  it("settles a giver's row unprompted when every candidate is alike", async () => {
    const d = deps();
    const result = await runSettleBatch([{ trade: trade("t1", "giver", 1), quantity: 1 }], d);

    expect(d.settle).toHaveBeenCalledTimes(1);
    expect(result.pendingChoices).toEqual([]);
  });

  it("leaves a giver's row unsettled, with its tally, when the options read failed", async () => {
    const d = deps({
      readCopyOptions: vi.fn(async (tradeId: string) => (tradeId === "t1" ? null : options(false))),
    });
    const result = await runSettleBatch(
      [
        { trade: trade("t1", "giver", 1), quantity: 1 },
        { trade: trade("t2", "giver", 1), quantity: 1 },
      ],
      d,
    );

    expect(d.settle).toHaveBeenCalledTimes(1);
    expect(d.settle).toHaveBeenCalledWith(expect.objectContaining({ tradeId: "t2" }));
    expect(result).toEqual({ pendingChoices: [], settledTradeIds: ["t2"], failed: true });
  });

  it("keeps going after a row fails, and says that it did", async () => {
    const settle = vi.fn(async (variables: { tradeId: string }) => {
      if (variables.tradeId === "t1") {
        throw new Error("gone");
      }
      return undefined;
    });
    const result = await runSettleBatch(
      [
        { trade: trade("t1", "receiver", 1), quantity: 1 },
        { trade: trade("t2", "receiver", 1), quantity: 1 },
      ],
      deps({ settle }),
    );

    expect(settle).toHaveBeenCalledTimes(2);
    expect(result.settledTradeIds).toEqual(["t2"]);
    expect(result.failed).toBe(true);
  });

  it("does nothing for an empty pile", async () => {
    const d = deps();
    const result = await runSettleBatch([], d);

    expect(d.settle).not.toHaveBeenCalled();
    expect(result).toEqual({ pendingChoices: [], settledTradeIds: [], failed: false });
  });
});

describe("readCopyOptionsReported", () => {
  beforeEach(() => {
    toastError.mockClear();
  });

  it("hands back the options when the read succeeds", async () => {
    const read = options(true);
    await expect(readCopyOptionsReported(async () => read)).resolves.toBe(read);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows the error and resolves null when the read fails", async () => {
    const result = await readCopyOptionsReported(async () => {
      throw new Error("Trade not found");
    });

    expect(result).toBeNull();
    expect(toastError).toHaveBeenCalledWith("Trade not found", expect.anything());
  });

  it("stays quiet while a stale bundle reloads", async () => {
    const result = await readCopyOptionsReported(async () => {
      throw new Error("stale");
    });

    expect(result).toBeNull();
    expect(toastError).not.toHaveBeenCalled();
  });
});
