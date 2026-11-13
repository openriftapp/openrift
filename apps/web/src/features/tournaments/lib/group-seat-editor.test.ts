import { describe, expect, it } from "vitest";

import { swapSeats } from "./group-seat-editor";

const groups = [
  { label: "A", pairedGroupLabel: null, playerIds: ["a1", "a2", "a3", "a4"] },
  { label: "B", pairedGroupLabel: null, playerIds: ["b1", "b2", "b3", "b4"] },
];

describe("swapSeats", () => {
  it("swaps two players across groups and keeps every size", () => {
    const next = swapSeats(groups, "a1", "b3");
    expect(next[0]?.playerIds).toEqual(["b3", "a2", "a3", "a4"]);
    expect(next[1]?.playerIds).toEqual(["b1", "b2", "a1", "b4"]);
  });

  it("swaps seats inside one group and ignores a self-drop", () => {
    expect(swapSeats(groups, "a2", "a4")[0]?.playerIds).toEqual(["a1", "a4", "a3", "a2"]);
    expect(swapSeats(groups, "a2", "a2")).toEqual(groups);
  });
});
