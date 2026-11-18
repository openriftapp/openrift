import { describe, expect, it } from "vitest";

import { resolveDirection } from "./keys.js";

describe("resolveDirection", () => {
  it.each([
    ["keeps an explicit asc", "usd", "asc", "asc"],
    ["keeps an explicit desc", "name", "desc", "desc"],
    ["puts the priciest first under auto", "usd", "auto", "desc"],
    ["puts the priciest first without a direction", "eur", undefined, "desc"],
    ["puts the newest first without a direction", "released", undefined, "desc"],
    ["sorts by name A to Z under auto", "name", "auto", "asc"],
    ["sorts by might A to Z without a direction", "might", undefined, "asc"],
  ] as const)("%s", (_title, order, direction, expected) => {
    expect(resolveDirection(order, direction)).toBe(expected);
  });

  it("puts the priciest first for the price order", () => {
    expect(resolveDirection("price")).toBe("desc");
  });
});
