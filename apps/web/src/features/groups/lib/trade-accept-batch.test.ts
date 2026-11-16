import type {
  CardTradeCopyOptionsResponse,
  CardTradeResponse,
  CardTradeRole,
} from "@openrift/shared/types/api/card-trade";
import { describe, expect, it, vi } from "vitest";

import { runAcceptBatch } from "./trade-accept-batch";

function trade(id: string, role: CardTradeRole): CardTradeResponse {
  return { id, role, groupSlug: "friday-night" } as unknown as CardTradeResponse;
}

function options(choiceMatters: boolean): CardTradeCopyOptionsResponse {
  return { tradeId: "t", quantity: 1, choiceMatters, copies: [] } as CardTradeCopyOptionsResponse;
}

function deps({
  choiceMatters = () => false,
  acceptFails = false,
}: {
  choiceMatters?: (tradeId: string) => boolean | null;
  acceptFails?: boolean;
} = {}) {
  return {
    accept: vi.fn(async (_variables: { tradeId: string; groupSlug?: string }) => {
      if (acceptFails) {
        throw new Error("gone");
      }
    }),
    readCopyOptions: vi.fn(async (tradeId: string) => {
      const matters = choiceMatters(tradeId);
      return matters === null ? null : options(matters);
    }),
    onTradeDone: vi.fn((_tradeId: string) => {}),
  };
}

describe("runAcceptBatch", () => {
  it("accepts a giver's trade without a copy choice when the copies are alike", async () => {
    const d = deps();
    const awaiting = await runAcceptBatch([trade("t1", "giver")], d);

    expect(d.accept).toHaveBeenCalledWith({ tradeId: "t1", groupSlug: "friday-night" });
    expect(awaiting).toEqual([]);
  });

  it("leaves a giver's trade whose copies differ pending and names it", async () => {
    const d = deps({ choiceMatters: (tradeId) => tradeId === "t2" });
    const awaiting = await runAcceptBatch(
      [trade("t1", "giver"), trade("t2", "giver"), trade("t3", "giver")],
      d,
    );

    expect(d.accept.mock.calls.map(([variables]) => variables.tradeId)).toEqual(["t1", "t3"]);
    expect(awaiting).toEqual(["t2"]);
  });

  it("accepts the receiver's side without reading copy options", async () => {
    const d = deps();
    await runAcceptBatch([trade("t1", "receiver")], d);

    expect(d.readCopyOptions).not.toHaveBeenCalled();
    expect(d.accept).toHaveBeenCalledOnce();
  });

  it("leaves a trade untouched when its copy options cannot be read and goes on", async () => {
    const d = deps({ choiceMatters: (tradeId) => (tradeId === "t1" ? null : false) });
    const awaiting = await runAcceptBatch([trade("t1", "giver"), trade("t2", "giver")], d);

    expect(d.accept.mock.calls.map(([variables]) => variables.tradeId)).toEqual(["t2"]);
    expect(awaiting).toEqual([]);
  });

  it("releases every trade once it is handled, whatever the outcome", async () => {
    const d = deps({
      choiceMatters: (tradeId) => (tradeId === "t1" ? null : tradeId === "t2"),
      acceptFails: true,
    });
    await runAcceptBatch([trade("t1", "giver"), trade("t2", "giver"), trade("t3", "giver")], d);

    expect(d.onTradeDone.mock.calls.map(([tradeId]) => tradeId)).toEqual(["t1", "t2", "t3"]);
  });
});
