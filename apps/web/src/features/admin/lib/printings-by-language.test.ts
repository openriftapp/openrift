import { describe, expect, it } from "vitest";

import { groupPrintingsByLanguage } from "./printings-by-language";

const ORDER = ["EN", "DE", "FR"];

function printing(id: string, language: string) {
  return { id, language };
}

describe("groupPrintingsByLanguage", () => {
  it("orders the groups the way the admin language list does", () => {
    const grouped = groupPrintingsByLanguage(
      [printing("p1", "FR"), printing("p2", "EN"), printing("p3", "DE")],
      ORDER,
    );

    expect(grouped.map(([language]) => language)).toEqual(["EN", "DE", "FR"]);
  });

  it("keeps every printing of a language together, in the order it was given", () => {
    const grouped = groupPrintingsByLanguage(
      [printing("p1", "DE"), printing("p2", "EN"), printing("p3", "DE")],
      ORDER,
    );

    expect(grouped).toEqual([
      ["EN", [printing("p2", "EN")]],
      ["DE", [printing("p1", "DE"), printing("p3", "DE")]],
    ]);
  });

  it("sorts a language the admin list does not carry to the end, alphabetically", () => {
    const grouped = groupPrintingsByLanguage(
      [printing("p1", "SC"), printing("p2", "JP"), printing("p3", "EN")],
      ORDER,
    );

    expect(grouped.map(([language]) => language)).toEqual(["EN", "JP", "SC"]);
  });

  it("has no groups without printings", () => {
    expect(groupPrintingsByLanguage([], ORDER)).toEqual([]);
  });
});
