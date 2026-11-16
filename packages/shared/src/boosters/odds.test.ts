import { describe, expect, it } from "vitest";

import { packFrequency, unitFrequency } from "./odds.js";

describe("packFrequency", () => {
  it("reads a rate of one or more as per pack and a smaller one as 1 in N packs", () => {
    expect(packFrequency(7)).toEqual({ kind: "per", count: 7 });
    expect(packFrequency(1.6514)).toEqual({ kind: "per", count: 1.65 });
    expect(packFrequency(1 / 12.5)).toEqual({ kind: "one-in", count: 12.5 });
    expect(packFrequency(1 / 720)).toEqual({ kind: "one-in", count: 720 });
    expect(packFrequency(0.9583)).toEqual({ kind: "per", count: 0.96 });
  });
});

describe("unitFrequency", () => {
  it("gives an Origins Common about 2.2 per box and an Epic 1 in 7 boxes", () => {
    expect(unitFrequency(7 / 78, 24)).toEqual({ kind: "per", count: 2.2 });
    expect(unitFrequency(0.25 / 42, 24)).toEqual({ kind: "one-in", count: 7 });
    expect(unitFrequency(1 / 720 / 12, 24)).toEqual({ kind: "one-in", count: 360 });
  });
});
