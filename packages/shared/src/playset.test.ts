import { describe, expect, it } from "vitest";

import { getPlaysetSize } from "./playset.js";

describe("getPlaysetSize", () => {
  it.each([
    ["returns 1 for a Legend whatever its keywords", ["legend"], ["Shield"], 1],
    ["returns 1 for a Unit with the Unique keyword", ["unit"], ["Unique", "Shield"], 1],
    ["returns 3 for a Unit without the Unique keyword", ["unit"], ["Shield", "Accelerate"], 3],
    ["returns 3 for a Spell without keywords", ["spell"], [], 3],
    ["returns 3 for a Unit Gear, which has no 1-copy type", ["unit", "gear"], [], 3],
    ["returns 1 when any type is Legend", ["unit", "legend"], [], 1],
    ["returns 1 when any type is Battlefield", ["unit", "battlefield"], [], 1],
  ] as const)("%s", (_title, cardTypes, keywords, expected) => {
    expect(getPlaysetSize(cardTypes, keywords)).toBe(expected);
  });
});
