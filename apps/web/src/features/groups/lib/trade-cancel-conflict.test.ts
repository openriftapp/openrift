import type { CardTradeLiveAnnotation } from "@openrift/shared/types/api/card-trade";
import { ORPCError } from "@orpc/client";
import { describe, expect, it, vi } from "vitest";

import { UserDeclinedError } from "@/lib/user-declined-error";

import type { CancelledTrade } from "./trade-cancel-conflict";
import {
  hasPendingGiverTrade,
  sendWithTradeCancelConsent,
  tradeCancelConsentMetadata,
  tradeCancelConsentOf,
} from "./trade-cancel-conflict";

function trade(id: string): CancelledTrade {
  return { id, cardId: "card-1", printingId: "p1", quantity: 1, counterpartyName: "Mara" };
}

function refusal(trades: CancelledTrade[]): ORPCError<"CONFLICT", unknown> {
  return new ORPCError("CONFLICT", { defined: true, status: 409, data: { trades } });
}

const giving: CardTradeLiveAnnotation = {
  printingId: "p1",
  role: "giver",
  phase: "offered",
  tradeCount: 1,
  quantity: 1,
};

describe("hasPendingGiverTrade", () => {
  it("counts an offer or a request where the viewer gives a listed printing", () => {
    expect(hasPendingGiverTrade([giving], new Set(["p1"]))).toBe(true);
    expect(hasPendingGiverTrade([{ ...giving, phase: "asked" }], new Set(["p1"]))).toBe(true);
  });

  it("ignores other printings, the receiving side and trades past pending", () => {
    const printings = new Set(["p1"]);
    expect(hasPendingGiverTrade([{ ...giving, printingId: "p2" }], printings)).toBe(false);
    expect(hasPendingGiverTrade([{ ...giving, role: "receiver" }], printings)).toBe(false);
    expect(hasPendingGiverTrade([{ ...giving, phase: "reserved" }], printings)).toBe(false);
  });

  it("counts any printing when none are given", () => {
    expect(hasPendingGiverTrade([{ ...giving, printingId: "p9" }])).toBe(true);
    expect(hasPendingGiverTrade([])).toBe(false);
  });
});

describe("tradeCancelConsentMetadata", () => {
  it("carries the consent through mutation metadata", () => {
    const consent = { tradeIds: new Set<string>(), ask: vi.fn() };

    expect(tradeCancelConsentOf(tradeCancelConsentMetadata(consent))).toBe(consent);
    expect(tradeCancelConsentOf({})).toBeUndefined();
    expect(tradeCancelConsentOf(undefined)).toBeUndefined();
  });
});

describe("sendWithTradeCancelConsent", () => {
  it("sends without ids and asks nothing when nothing is confirmed or refused", async () => {
    const ask = vi.fn();
    const call = vi.fn(async (_ids?: string[]) => "done");

    await expect(sendWithTradeCancelConsent({ tradeIds: new Set(), ask }, call)).resolves.toBe(
      "done",
    );
    expect(call).toHaveBeenCalledWith(undefined);
    expect(ask).not.toHaveBeenCalled();
  });

  it("asks only about trades not yet confirmed and resends with every confirmed id", async () => {
    const ask = vi.fn(async () => true);
    const consent = { tradeIds: new Set(["t1"]), ask };
    const call = vi
      .fn<(ids?: string[]) => Promise<string>>()
      .mockRejectedValueOnce(refusal([trade("t1"), trade("t2")]))
      .mockResolvedValueOnce("done");

    await sendWithTradeCancelConsent(consent, call);

    expect(ask).toHaveBeenCalledWith([trade("t2")]);
    expect(call.mock.calls).toEqual([[["t1"]], [["t1", "t2"]]]);
    expect([...consent.tradeIds]).toEqual(["t1", "t2"]);
  });

  it("rejects with UserDeclinedError when the user keeps the trades", async () => {
    const call = vi.fn(async () => {
      throw refusal([trade("t1")]);
    });

    await expect(
      sendWithTradeCancelConsent({ tradeIds: new Set(), ask: async () => false }, call),
    ).rejects.toBeInstanceOf(UserDeclinedError);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("rethrows a refusal that names only trades already confirmed", async () => {
    const error = refusal([trade("t1")]);
    const ask = vi.fn();

    await expect(
      sendWithTradeCancelConsent({ tradeIds: new Set(["t1"]), ask }, async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(ask).not.toHaveBeenCalled();
  });
});
