import { describe, expect, it } from "vitest";

import { describeSearchTerms } from "./search-clause-labels";

const RAW = (_key: string, value: string) => value;

function chips(query: string, vocabulary = {}) {
  return describeSearchTerms(query, vocabulary, RAW).map((chip) => ({
    text: chip.text,
    source: query.slice(chip.span.start, chip.span.end),
    tone: chip.tone,
  }));
}

describe("describeSearchTerms", () => {
  it("gives each top-level keyed term its text and source span", () => {
    expect(chips("(o:buff or (o:stun t:spell)) -(o:draw or o:recall) e<=3")).toEqual([
      {
        text: "card text contains “buff” or (card text contains “stun” and type contains “spell”)",
        source: "(o:buff or (o:stun t:spell))",
        tone: "term",
      },
      {
        text: "not (card text contains “draw” or card text contains “recall”)",
        source: "-(o:draw or o:recall)",
        tone: "term",
      },
      { text: "energy ≤ 3", source: "e<=3", tone: "term" },
    ]);
  });

  it("skips plain words", () => {
    expect(chips("jinx rebel")).toEqual([]);
    expect(chips("jinx t:unit").map((chip) => chip.source)).toEqual(["t:unit"]);
  });

  it("lists a directive as a term", () => {
    expect(chips("t:unit order:name")).toEqual([
      { text: "type contains “unit”", source: "t:unit", tone: "term" },
      expect.objectContaining({ source: "order:name", tone: "term" }),
    ]);
  });

  it("lists problems in query order with their severity", () => {
    expect(chips("zz:x t:unit e<=x")).toEqual([
      { text: "Unknown key “zz:”, ignored", source: "zz:x", tone: "warning" },
      { text: "type contains “unit”", source: "t:unit", tone: "term" },
      { text: "“x” doesn't work with e:", source: "e<=x", tone: "error" },
    ]);
  });

  it("flags a value outside the vocabulary", () => {
    expect(chips("d:purple", { domain: ["fury"] })).toEqual([
      { text: "No domain called “purple”, ignored", source: "d:purple", tone: "warning" },
    ]);
  });
});
