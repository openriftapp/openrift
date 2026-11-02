import { describe, expect, it } from "vitest";

import { removeSearchSpan, searchTermSpan } from "./edit.js";
import { parseSearchQuery } from "./parse.js";

function topLevelTerms(raw: string): string[] {
  const { root, terms } = parseSearchQuery(raw);
  if (!root) {
    return [];
  }
  const nodes = root.kind === "and" ? root.children : [root];
  return nodes.map((node) => {
    const span = searchTermSpan(node, terms);
    return raw.slice(span.start, span.end);
  });
}

describe("searchTermSpan", () => {
  it("returns each top-level clause", () => {
    expect(topLevelTerms("o:buff  e<=3 t:unit")).toEqual(["o:buff", "e<=3", "t:unit"]);
  });

  it("includes the brackets and leading minus of a group", () => {
    expect(topLevelTerms("(o:buff or (o:stun and t:spell)) -(o:draw or o:recall) e<=3")).toEqual([
      "(o:buff or (o:stun and t:spell))",
      "-(o:draw or o:recall)",
      "e<=3",
    ]);
  });

  it("treats a top-level or-chain as one term", () => {
    expect(topLevelTerms("o:buff t:unit or o:stun")).toEqual(["o:buff t:unit or o:stun"]);
  });

  it("keeps a negated clause's minus", () => {
    expect(topLevelTerms("-t:spell jinx")).toEqual(["-t:spell", "jinx"]);
  });

  it("covers a quoted value", () => {
    expect(topLevelTerms('o:"deal 3" t:unit')).toEqual(['o:"deal 3"', "t:unit"]);
  });
});

describe("removeSearchSpan", () => {
  it("removes a middle term and joins the rest with one space", () => {
    expect(removeSearchSpan("o:buff e<=3 t:unit", { start: 7, end: 11 })).toBe("o:buff t:unit");
  });

  it("removes the first and last term without stray spaces", () => {
    expect(removeSearchSpan("o:buff e<=3", { start: 0, end: 6 })).toBe("e<=3");
    expect(removeSearchSpan("o:buff e<=3", { start: 7, end: 11 })).toBe("o:buff");
  });

  it("returns an empty query when the only term goes", () => {
    expect(removeSearchSpan(" o:buff ", { start: 1, end: 7 })).toBe("");
  });

  it("takes a leading minus with the span", () => {
    expect(removeSearchSpan("jinx -zz:x", { start: 6, end: 10 })).toBe("jinx");
  });

  it("takes the or that would be left between two branches", () => {
    expect(removeSearchSpan("t:unit or zz:x or d:fury", { start: 10, end: 14 })).toBe(
      "t:unit or d:fury",
    );
  });

  it("takes an or left dangling at either end of the chain", () => {
    expect(removeSearchSpan("t:unit or zz:x", { start: 10, end: 14 })).toBe("t:unit");
    expect(removeSearchSpan("zz:x or t:unit", { start: 0, end: 4 })).toBe("t:unit");
    expect(removeSearchSpan("(t:unit or zz:x) d:fury", { start: 11, end: 15 })).toBe(
      "(t:unit) d:fury",
    );
  });

  it("keeps a leading or, which the parser reads as a plain word", () => {
    expect(removeSearchSpan("or zz:x", { start: 3, end: 7 })).toBe("or");
  });

  it("keeps an or that still joins two branches", () => {
    expect(removeSearchSpan("a or zz:x b", { start: 5, end: 9 })).toBe("a or b");
  });

  it("removes brackets the removal leaves empty", () => {
    expect(removeSearchSpan("(zz:y) t:unit", { start: 1, end: 5 })).toBe("t:unit");
    expect(removeSearchSpan("x -(zz:y)", { start: 4, end: 8 })).toBe("x");
    expect(removeSearchSpan("((zz:y)) x", { start: 2, end: 6 })).toBe("x");
  });

  it("does not pad against brackets", () => {
    expect(removeSearchSpan("(o:buff zz:x) t:unit", { start: 8, end: 12 })).toBe("(o:buff) t:unit");
    expect(removeSearchSpan("(zz:x o:buff)", { start: 1, end: 5 })).toBe("(o:buff)");
  });
});
