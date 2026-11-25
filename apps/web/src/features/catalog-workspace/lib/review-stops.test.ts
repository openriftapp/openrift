import { describe, expect, it } from "vitest";

import { nextPendingStop, reviewStops, stopPosition } from "./review-stops";

const pass = {
  faces: [
    { face: { faceId: "f1" }, pending: true },
    { face: { faceId: "f2" }, pending: false },
    { face: { faceId: "f3" }, pending: true },
  ],
  printings: [
    { printing: { id: "p1" }, pending: false },
    { printing: { id: "p2" }, pending: true },
  ],
};
const stops = reviewStops(pass);

describe("nextPendingStop", () => {
  it("walks the card, then faces with work, then printings with work", () => {
    expect(nextPendingStop(stops, { kind: "card" })).toMatchObject({ kind: "face", faceId: "f1" });
    expect(nextPendingStop(stops, { kind: "face", faceId: "f1" })).toMatchObject({ faceId: "f3" });
    expect(nextPendingStop(stops, { kind: "face", faceId: "f3" })).toMatchObject({
      kind: "printing",
      printingId: "p2",
    });
  });

  it("is null after the last stop with work", () => {
    expect(nextPendingStop(stops, { kind: "printing", printingId: "p2" })).toBeNull();
  });

  it("continues from a stop whose work was just finished", () => {
    expect(nextPendingStop(stops, { kind: "face", faceId: "f2" })).toMatchObject({ faceId: "f3" });
  });
});

describe("stopPosition", () => {
  it("counts only stops with work", () => {
    expect(stopPosition(stops, { kind: "face", faceId: "f3" })).toEqual({ index: 2, total: 4 });
  });

  it("keeps a finished stop in the count while it is open", () => {
    expect(stopPosition(stops, { kind: "face", faceId: "f2" })).toEqual({ index: 2, total: 5 });
  });
});
