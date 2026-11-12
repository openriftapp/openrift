import { describe, expect, it } from "vitest";

import { tradeBatchText, tradeCompletedText } from "./friend-group-activity-copy";

const parties = {
  giverUserId: "u-1",
  giverName: "Ben",
  receiverUserId: "u-2",
  receiverName: "Mara",
};

describe("trade activity copy", () => {
  it("uses the second-person sentence when the viewer gave or received", () => {
    expect(tradeBatchText({ ...parties, totalQuantity: 2 }, "u-1")).toBe(
      "You traded 2 cards to Mara",
    );
    expect(tradeBatchText({ ...parties, totalQuantity: 2 }, "u-2")).toBe(
      "Ben traded 2 cards to you",
    );
    expect(tradeCompletedText({ ...parties, quantity: 1 }, "Jinx", "u-1")).toBe(
      "You traded 1× Jinx to Mara",
    );
  });

  it("never reads a closed party as the viewer", () => {
    const closed = { ...parties, giverUserId: null, giverName: null };
    expect(tradeBatchText({ ...closed, totalQuantity: 2 }, null)).toBe(
      "Former member traded 2 cards to Mara",
    );
  });
});
