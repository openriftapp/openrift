import { describe, expect, it } from "vitest";

import { isPlainClick } from "./plain-click";

const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

describe("isPlainClick", () => {
  it("accepts a left click without modifiers", () => {
    expect(isPlainClick(plain)).toBe(true);
  });

  it.each([
    ["middle button", { button: 1 }],
    ["meta", { metaKey: true }],
    ["ctrl", { ctrlKey: true }],
    ["shift", { shiftKey: true }],
    ["alt", { altKey: true }],
  ])("leaves a %s click to the browser", (_label, change) => {
    expect(isPlainClick({ ...plain, ...change })).toBe(false);
  });
});
