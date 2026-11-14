import { describe, expect, it } from "vitest";

import { developersShowcaseFields } from "./developers-showcase.js";

const ANNIE = {
  name: "Annie, Fiery",
  energy: 5,
  tags: ["Annie", "Noxus"],
  domains: ["fury"],
  rulesText:
    "Your spells and abilities deal 1 Bonus Damage. Then they deal some more damage again.",
  publicCode: "OGS-001/024",
};

describe("developersShowcaseFields", () => {
  it("lists the fields in the order the card frame reads top to bottom", () => {
    expect(developersShowcaseFields(ANNIE).map((field) => field.key)).toEqual([
      "energy",
      "tags",
      "name",
      "domains",
      "printedRulesText",
      "publicCode",
    ]);
  });

  it("shortens the rules text to a teaser", () => {
    const rules = developersShowcaseFields(ANNIE).find((field) => field.key === "printedRulesText");
    expect(rules?.value).toEqual({ kind: "string", value: expect.stringMatching(/…$/u) });
  });

  it("drops the fields a card leaves empty", () => {
    const keys = developersShowcaseFields({
      ...ANNIE,
      energy: null,
      tags: [],
      domains: [],
      rulesText: null,
    }).map((field) => field.key);
    expect(keys).toEqual(["name", "publicCode"]);
  });
});
