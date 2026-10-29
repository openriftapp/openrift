import { describe, expect, it } from "vitest";

import { translateLegacyQuery } from "./legacy.js";

describe("translateLegacyQuery", () => {
  it.each([
    ["d:stun", "o:stun"],
    ["t:demacia", "tag:demacia"],
    ["f:revenge", "ft:revenge"],
    ["id:ogn-001", "cn:ogn-001"],
    ["ty:unit", "t:unit"],
    ["k:shield", "kw:shield"],
    ["n:garen", "garen"],
    ['n:"jinx, rebel"', '"jinx, rebel"'],
    ["a:jane", "a:jane"],
  ])("rewrites %s to %s", (legacy, current) => {
    expect(translateLegacyQuery(legacy)).toBe(current);
  });

  it("rewrites every prefix in a mixed query and keeps bare words", () => {
    expect(translateLegacyQuery('fire k:shield d:"deal 3" ty:unit')).toBe(
      'fire kw:shield o:"deal 3" t:unit',
    );
  });

  it("leaves prefix-like text inside a word alone", () => {
    expect(translateLegacyQuery("ogn:269 https://x.test")).toBe("ogn:269 https://x.test");
  });
});
