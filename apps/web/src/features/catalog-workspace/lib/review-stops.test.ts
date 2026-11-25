import { describe, expect, it } from "vitest";

import { nextPendingStop, reviewStops, stopPosition } from "./review-stops";

const row = (id: string, pending: boolean) => ({ entry: { printing: { id } }, pending });
const stops = reviewStops({
  rows: [row("p1", true), row("p2", false), row("p3", true), row("p4", true)],
});

describe("nextPendingStop", () => {
  it("walks the card, then printings with work", () => {
    expect(nextPendingStop(stops, { kind: "card" })).toMatchObject({ printingId: "p1" });
    expect(nextPendingStop(stops, { kind: "printing", printingId: "p1" })).toMatchObject({
      printingId: "p3",
    });
  });

  it("is null after the last stop with work", () => {
    expect(nextPendingStop(stops, { kind: "printing", printingId: "p4" })).toBeNull();
  });

  it("continues from a stop whose work was just finished", () => {
    expect(nextPendingStop(stops, { kind: "printing", printingId: "p2" })).toMatchObject({
      printingId: "p3",
    });
  });
});

describe("stopPosition", () => {
  it("counts only stops with work", () => {
    expect(stopPosition(stops, { kind: "printing", printingId: "p3" })).toEqual({
      index: 2,
      total: 4,
    });
  });

  it("keeps a finished stop in the count while it is open", () => {
    expect(stopPosition(stops, { kind: "printing", printingId: "p2" })).toEqual({
      index: 2,
      total: 5,
    });
  });
});
