import { describe, expect, it } from "vitest";

import { splitCaption } from "./board-caption";

describe("splitCaption", () => {
  it("returns plain text as one segment", () => {
    expect(splitCaption("No rules here.")).toEqual([{ type: "text", text: "No rules here." }]);
  });

  it("splits rule references out of the text", () => {
    expect(splitCaption("See [[460.3]] and [[t:118]].")).toEqual([
      { type: "text", text: "See " },
      { type: "rule", ref: { kind: "core", ruleNumber: "460.3" } },
      { type: "text", text: " and " },
      { type: "rule", ref: { kind: "tournament", ruleNumber: "118" } },
      { type: "text", text: "." },
    ]);
  });

  it("handles a reference at the start and end", () => {
    expect(splitCaption("[[1]][[2.1]]")).toEqual([
      { type: "rule", ref: { kind: "core", ruleNumber: "1" } },
      { type: "rule", ref: { kind: "core", ruleNumber: "2.1" } },
    ]);
  });

  it("leaves malformed references as text", () => {
    expect(splitCaption("[[abc]] [460] [[x:1]]")).toEqual([
      { type: "text", text: "[[abc]] [460] [[x:1]]" },
    ]);
  });

  it("splits card references out of the text", () => {
    expect(splitCaption("Give [[card:p1]] a rune.")).toEqual([
      { type: "text", text: "Give " },
      { type: "card", pieceId: "p1" },
      { type: "text", text: " a rune." },
    ]);
  });

  it("mixes rule and card references", () => {
    expect(splitCaption("[[card:a1]] see [[t:118]]")).toEqual([
      { type: "card", pieceId: "a1" },
      { type: "text", text: " see " },
      { type: "rule", ref: { kind: "tournament", ruleNumber: "118" } },
    ]);
  });

  it("leaves a malformed card reference as text", () => {
    expect(splitCaption("[[card:]] [[card:P1]]")).toEqual([
      { type: "text", text: "[[card:]] [[card:P1]]" },
    ]);
  });

  it("returns nothing for an empty caption", () => {
    expect(splitCaption("")).toEqual([]);
  });
});
