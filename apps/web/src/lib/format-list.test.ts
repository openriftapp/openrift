import { describe, expect, it } from "vitest";

import { getLocale, overwriteGetLocale } from "@/paraglide/runtime.js";

import { formatList } from "./format-list";

const ITEMS = ["Jinx", "Vi", "Ekko", "Caitlyn"];

describe("formatList", () => {
  it("returns an empty string for no items and the item itself for one", () => {
    expect(formatList([], "and", "en")).toBe("");
    expect(formatList(["Jinx"], "and", "en")).toBe("Jinx");
  });

  it.each([
    ["en", "and", ["Jinx and Vi", "Jinx, Vi, and Ekko", "Jinx, Vi, Ekko, and Caitlyn"]],
    ["en", "or", ["Jinx or Vi", "Jinx, Vi, or Ekko", "Jinx, Vi, Ekko, or Caitlyn"]],
    ["de", "and", ["Jinx und Vi", "Jinx, Vi und Ekko", "Jinx, Vi, Ekko und Caitlyn"]],
    ["fr", "or", ["Jinx ou Vi", "Jinx, Vi ou Ekko", "Jinx, Vi, Ekko ou Caitlyn"]],
    ["ko", "and", ["Jinx 및 Vi", "Jinx, Vi 및 Ekko", "Jinx, Vi, Ekko 및 Caitlyn"]],
    ["zh-Hans", "and", ["Jinx和Vi", "Jinx、Vi和Ekko", "Jinx、Vi、Ekko和Caitlyn"]],
    ["zh-Hant", "or", ["Jinx或Vi", "Jinx、Vi或Ekko", "Jinx、Vi、Ekko或Caitlyn"]],
  ] as const)("joins %s %s lists of two to four items", (locale, type, expected) => {
    expect([2, 3, 4].map((count) => formatList(ITEMS.slice(0, count), type, locale))).toEqual(
      expected,
    );
  });

  it("keeps placeholder and replacement syntax inside items as text", () => {
    expect(formatList(["{1}", "$&", "{0}"], "and", "en")).toBe("{1}, $&, and {0}");
  });

  it("uses the viewer's locale by default", () => {
    const baseGetLocale = getLocale;
    overwriteGetLocale(() => "de");
    try {
      expect(formatList(["Jinx", "Vi"])).toBe("Jinx und Vi");
      expect(formatList(["Jinx", "Vi"], "or")).toBe("Jinx oder Vi");
    } finally {
      overwriteGetLocale(baseGetLocale);
    }
  });
});
