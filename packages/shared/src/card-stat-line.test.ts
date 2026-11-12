import { describe, expect, it } from "vitest";

import type { CardStatFields, CardStatLabels } from "./card-stat-line.js";
import { describeCardStats } from "./card-stat-line.js";
import { labelMapOf } from "./enum-label.js";

const labels: CardStatLabels = {
  superTypes: labelMapOf({ champion: "Champion" }),
  cardTypes: labelMapOf({ unit: "Unit", gear: "Gear" }),
  domains: labelMapOf({ fury: "Fury", calm: "Calm" }),
};

function card(overrides: Partial<CardStatFields> = {}): CardStatFields {
  return {
    superTypes: ["champion"],
    types: ["unit"],
    domains: ["fury"],
    energy: 3,
    might: 4,
    power: null,
    ...overrides,
  };
}

describe("describeCardStats", () => {
  it("includes every stat when all are present", () => {
    expect(describeCardStats(card({ power: 2 }), labels)).toBe(
      "Champion Unit · Fury · Energy 3 · Might 4 · Power 2",
    );
  });

  it("skips energy when absent", () => {
    expect(describeCardStats(card({ energy: null }), labels)).toBe(
      "Champion Unit · Fury · Might 4",
    );
  });

  it("skips might when absent", () => {
    expect(describeCardStats(card({ might: null }), labels)).toBe(
      "Champion Unit · Fury · Energy 3",
    );
  });

  it("skips power when absent", () => {
    expect(describeCardStats(card({ power: null }), labels)).toBe(
      "Champion Unit · Fury · Energy 3 · Might 4",
    );
  });

  it("skips the domain segment when there are no domains", () => {
    expect(describeCardStats(card({ domains: [] }), labels)).toBe(
      "Champion Unit · Energy 3 · Might 4",
    );
  });

  it("skips super types when there are none", () => {
    expect(describeCardStats(card({ superTypes: [] }), labels)).toBe(
      "Unit · Fury · Energy 3 · Might 4",
    );
  });

  it("renders a single type with no super types", () => {
    expect(describeCardStats(card({ superTypes: [], types: ["gear"] }), labels)).toBe(
      "Gear · Fury · Energy 3 · Might 4",
    );
  });

  it("joins multiple domains with slashes", () => {
    expect(describeCardStats(card({ domains: ["fury", "calm"] }), labels)).toBe(
      "Champion Unit · Fury / Calm · Energy 3 · Might 4",
    );
  });

  it("falls back to the slug for a type or domain with no label row", () => {
    expect(describeCardStats(card({ types: ["token"], domains: ["chaos"] }), labels)).toBe(
      "Champion token · chaos · Energy 3 · Might 4",
    );
  });

  it("drops a deliberately empty label", () => {
    const withEmpty = { ...labels, domains: labelMapOf({ fury: "" }) };
    expect(describeCardStats(card(), withEmpty)).toBe("Champion Unit · Energy 3 · Might 4");
  });
});
