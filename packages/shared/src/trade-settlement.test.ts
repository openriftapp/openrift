import { describe, expect, it } from "vitest";

import { tradeSettlementFingerprint } from "./trade-settlement";

describe("tradeSettlementFingerprint", () => {
  it("normalizes copy ordering without mutating the choice", () => {
    const copyIds = ["b", "a"];
    expect(tradeSettlementFingerprint("apply", { copyIds })).toBe(
      tradeSettlementFingerprint("apply", { copyIds: ["a", "b"] }),
    );
    expect(copyIds).toEqual(["b", "a"]);
  });

  it("distinguishes actions, quantities and destinations", () => {
    const fingerprints = [
      tradeSettlementFingerprint("apply", {}),
      tradeSettlementFingerprint("skip", {}),
      tradeSettlementFingerprint("apply", { quantity: 1 }),
      tradeSettlementFingerprint("apply", { targetCollectionId: "inbox" }),
      tradeSettlementFingerprint("apply", { copyIds: ["a"] }),
    ];
    expect(new Set(fingerprints).size).toBe(fingerprints.length);
  });
});
