import { describe, expect, it } from "vitest";

import { agreedSeenState, newAgreedTrades } from "./trade-seen";

const AGREED = {
  autoAccepted: true,
  status: "reserved",
  role: "receiver",
  initiator: "giver",
  recipientSeenAt: null,
} as const;

describe("agreedSeenState", () => {
  it("is new for the recipient who has not looked yet", () => {
    expect(agreedSeenState(AGREED)).toBe("new");
  });

  it("has no state for the recipient once they have looked", () => {
    expect(agreedSeenState({ ...AGREED, recipientSeenAt: "2026-11-18T10:00:00.000Z" })).toBeNull();
  });

  it("tells the sender the recipient has not looked yet", () => {
    expect(agreedSeenState({ ...AGREED, role: "giver" })).toBe("unseen-by-them");
  });

  it("tells the sender once the recipient has looked", () => {
    expect(
      agreedSeenState({ ...AGREED, role: "giver", recipientSeenAt: "2026-11-18T10:00:00.000Z" }),
    ).toBe("seen-by-them");
  });

  it("has no state for a trade the recipient accepted by hand", () => {
    expect(agreedSeenState({ ...AGREED, autoAccepted: false })).toBeNull();
  });

  it("has no state once the trade is no longer reserved", () => {
    expect(agreedSeenState({ ...AGREED, status: "completed" })).toBeNull();
    expect(agreedSeenState({ ...AGREED, status: "cancelled" })).toBeNull();
  });

  it("covers a request the giver's setting accepted", () => {
    const request = { ...AGREED, initiator: "receiver" } as const;
    expect(agreedSeenState({ ...request, role: "giver" })).toBe("new");
    expect(agreedSeenState({ ...request, role: "receiver" })).toBe("unseen-by-them");
  });
});

describe("newAgreedTrades", () => {
  it("keeps only the trades that are new for the viewer", () => {
    const seen = { ...AGREED, recipientSeenAt: "2026-11-18T10:00:00.000Z" };
    expect(newAgreedTrades([AGREED, seen, { ...AGREED, role: "giver" }])).toEqual([AGREED]);
  });
});
