import type { TradeSuggestionDismissal } from "@openrift/shared/types/api/card-trade";
import { describe, expect, it } from "vitest";

import { dismissalKey, dismissalKeys, withDismissals, withoutDismissal } from "./trade-dismissals";

const ROBOGIRL: TradeSuggestionDismissal = {
  direction: "outgoing",
  counterpartyUserId: "user-robogirl",
  printingId: "printing-1",
};

describe("dismissalKey", () => {
  it("tells directions apart for the same person and printing", () => {
    expect(dismissalKey(ROBOGIRL)).not.toBe(dismissalKey({ ...ROBOGIRL, direction: "incoming" }));
  });
});

describe("withDismissals", () => {
  it("adds new dismissals and skips ones already there", () => {
    const other = { ...ROBOGIRL, printingId: "printing-2" };
    expect(withDismissals([ROBOGIRL], [ROBOGIRL, other])).toEqual([ROBOGIRL, other]);
  });
});

describe("withoutDismissal", () => {
  it("removes exactly the matching dismissal", () => {
    const other = { ...ROBOGIRL, printingId: "printing-2" };
    expect(withoutDismissal([ROBOGIRL, other], { ...ROBOGIRL })).toEqual([other]);
  });
});

describe("dismissalKeys", () => {
  it("collects one key per dismissal", () => {
    expect(dismissalKeys([ROBOGIRL, ROBOGIRL]).size).toBe(1);
  });
});
