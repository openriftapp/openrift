import { describe, expect, it } from "vitest";

import { countQueryNodes, parseSearchQuery, pruneIgnored } from "./parse.js";

describe("parseSearchQuery", () => {
  it("returns no tree for an empty or blank query", () => {
    expect(parseSearchQuery("").root).toBeNull();
    expect(parseSearchQuery("   ").root).toBeNull();
  });

  it("parses bare words as text nodes joined by and", () => {
    expect(parseSearchQuery("fire dragon").root).toEqual({
      kind: "and",
      children: [
        { kind: "text", value: "fire", span: { start: 0, end: 4 } },
        { kind: "text", value: "dragon", span: { start: 5, end: 11 } },
      ],
    });
  });

  it("keeps a quoted phrase as one text node", () => {
    expect(parseSearchQuery('"fire dragon"').root).toEqual({
      kind: "text",
      value: "fire dragon",
      span: { start: 0, end: 13 },
    });
  });

  it("parses keyed clauses with their operator and lowercases enum values", () => {
    const parsed = parseSearchQuery("t:Unit d:FURY e<=3");
    expect(parsed.clauses.map(({ key, operator, value }) => [key, operator, value])).toEqual([
      ["type", ":", "Unit"],
      ["domain", ":", "fury"],
      ["energy", "<=", "3"],
    ]);
    expect(parsed.diagnostics).toEqual([]);
  });

  it("resolves long aliases", () => {
    const parsed = parseSearchQuery("type:unit oracle:stun keyword:shield legal:standard");
    expect(parsed.clauses.map((clause) => clause.key)).toEqual([
      "type",
      "oracle",
      "keyword",
      "format",
    ]);
  });

  it("reads a quoted clause value", () => {
    expect(parseSearchQuery('o:"deal 3"').clauses[0]).toMatchObject({
      key: "oracle",
      value: "deal 3",
    });
  });

  it("parses or with lower precedence than and", () => {
    expect(parseSearchQuery("a b or c").root).toMatchObject({
      kind: "or",
      children: [{ kind: "and" }, { kind: "text", value: "c" }],
    });
  });

  it("groups with parentheses", () => {
    expect(parseSearchQuery("(d:fury or d:chaos) t:unit").root).toMatchObject({
      kind: "and",
      children: [
        {
          kind: "or",
          children: [
            { kind: "clause", key: "domain", value: "fury" },
            { kind: "clause", key: "domain", value: "chaos" },
          ],
        },
        { kind: "clause", key: "type", value: "unit" },
      ],
    });
  });

  it("negates a clause or a group and marks the clauses negated", () => {
    const parsed = parseSearchQuery("-t:spell -(r:common or r:uncommon)");
    expect(parsed.root).toMatchObject({
      kind: "and",
      children: [{ kind: "not" }, { kind: "not", child: { kind: "or" } }],
    });
    expect(parsed.clauses.every((clause) => clause.negated)).toBe(true);
  });

  it("double negation flips the flag back", () => {
    expect(parseSearchQuery("--t:spell").clauses[0]?.negated).toBe(false);
  });

  it("reads a lone hyphen as a word", () => {
    expect(parseSearchQuery("-").root).toMatchObject({ kind: "text", value: "-" });
  });

  it("treats a leading or as a word", () => {
    expect(parseSearchQuery("or").root).toMatchObject({ kind: "text", value: "or" });
  });

  it("parses an exact name", () => {
    const parsed = parseSearchQuery('!"Jinx, Rebel"');
    expect(parsed.root).toMatchObject({ kind: "exact", value: "Jinx, Rebel" });
  });

  it("collects directives without adding filter nodes", () => {
    const parsed = parseSearchQuery("order:energy direction:desc unique:prints t:unit");
    expect(parsed.directives).toEqual({ order: "energy", direction: "desc", unique: "prints" });
    expect(parsed.root).toMatchObject({ kind: "clause", key: "type" });
  });

  it("drops a trailing comma from an unquoted value", () => {
    expect(parseSearchQuery("t:spell, d:fury").clauses.map((clause) => clause.value)).toEqual([
      "spell",
      "fury",
    ]);
    expect(parseSearchQuery('o:"deal 3,"').clauses[0]?.value).toBe("deal 3,");
  });

  it("reads a domain list and drops empty entries", () => {
    expect(parseSearchQuery("d<=Fury,,Chaos").clauses[0]).toMatchObject({
      key: "domain",
      operator: "<=",
      value: "fury,chaos",
    });
  });

  it("takes comparisons on card numbers only with a number", () => {
    expect(parseSearchQuery("cn>=100").clauses[0]).toMatchObject({ key: "number", value: "100" });
    expect(parseSearchQuery("cn>=ogn").diagnostics[0]).toMatchObject({ code: "badValue" });
    expect(parseSearchQuery("cn:OGN-001").clauses[0]?.value).toBe("OGN-001");
  });

  it("reads prefer: as a directive", () => {
    expect(parseSearchQuery("prefer:usd-low").directives).toEqual({ prefer: "usd-low" });
    expect(parseSearchQuery("prefer:best").diagnostics[0]).toMatchObject({
      code: "unknownValue",
      severity: "warning",
    });
  });

  it("reads is: aliases as their canonical value", () => {
    expect(parseSearchQuery("is:alternate").clauses[0]?.value).toBe("altart");
    expect(parseSearchQuery("is:alt").clauses[0]?.value).toBe("altart");
    expect(parseSearchQuery("is:nonfoil").clauses[0]?.value).toBe("nonfoil");
    expect(parseSearchQuery("is:variant").clauses[0]?.value).toBe("variant");
  });

  it("reads pow as power", () => {
    expect(parseSearchQuery("pow>=2").clauses[0]).toMatchObject({ key: "power", value: "2" });
  });

  it("reads tag: as the tag key", () => {
    expect(parseSearchQuery("tag:noxus").clauses[0]).toMatchObject({ key: "tag", value: "noxus" });
  });

  it("reads the display directives", () => {
    expect(parseSearchQuery("order:usd direction:auto unique:art").directives).toEqual({
      order: "usd",
      direction: "auto",
      unique: "art",
    });
  });

  describe("single quotes", () => {
    it("quote a value", () => {
      expect(parseSearchQuery("o:'deal 3'").clauses[0]?.value).toBe("deal 3");
    });

    it("quote a bare phrase", () => {
      expect(parseSearchQuery("'arcane comet'").root).toMatchObject({
        kind: "text",
        value: "arcane comet",
      });
    });

    it("leave an apostrophe inside a word alone", () => {
      expect(parseSearchQuery("kai'sa").root).toMatchObject({ kind: "text", value: "kai'sa" });
    });

    it("stay literal inside a double-quoted value", () => {
      expect(parseSearchQuery(`!"Kai'Sa, Survivor"`).root).toMatchObject({
        kind: "exact",
        value: "Kai'Sa, Survivor",
      });
    });

    it("run to the end when unclosed", () => {
      expect(parseSearchQuery("o:'draw a").clauses[0]?.value).toBe("draw a");
    });
  });

  it("normalizes a hyphenated is value", () => {
    expect(parseSearchQuery("is:metal-deluxe").clauses[0]?.value).toBe("metaldeluxe");
  });

  describe("diagnostics", () => {
    it("ignores an unknown key with a warning", () => {
      const parsed = parseSearchQuery("foo:bar");
      expect(parsed.root).toEqual({ kind: "ignored", span: { start: 0, end: 7 } });
      expect(parsed.diagnostics).toEqual([
        { code: "unknownKey", severity: "warning", span: { start: 0, end: 7 }, key: "foo" },
      ]);
    });

    it("flags a malformed number and matches nothing", () => {
      const parsed = parseSearchQuery("e<=x");
      expect(parsed.root).toMatchObject({ kind: "invalid" });
      expect(parsed.diagnostics[0]).toMatchObject({ code: "badValue", severity: "error" });
    });

    it("flags an operator the key does not take", () => {
      const parsed = parseSearchQuery("t>unit");
      expect(parsed.root).toMatchObject({ kind: "invalid" });
      expect(parsed.diagnostics[0]).toMatchObject({ code: "badOperator" });
    });

    it("ignores an unknown is value with a warning", () => {
      const parsed = parseSearchQuery("is:shiny");
      expect(parsed.root).toMatchObject({ kind: "ignored" });
      expect(parsed.diagnostics[0]).toMatchObject({ code: "unknownValue", severity: "warning" });
    });

    it("ignores an unknown directive value with a warning", () => {
      const parsed = parseSearchQuery("order:color");
      expect(parsed.directives).toEqual({});
      expect(parsed.diagnostics[0]).toMatchObject({ code: "unknownValue", severity: "warning" });
    });

    it("keeps the rest of the query around an ignored clause", () => {
      expect(pruneIgnored(parseSearchQuery("cost:3 t:unit").root)).toMatchObject({
        kind: "clause",
        key: "type",
      });
      expect(pruneIgnored(parseSearchQuery("-zz:x or (is:shiny)").root)).toBeNull();
    });

    it("ignores a key with no value yet", () => {
      const parsed = parseSearchQuery("o:");
      expect(parsed.root).toBeNull();
      expect(parsed.diagnostics[0]).toMatchObject({ code: "emptyValue", severity: "warning" });
    });

    it("reports an unclosed group", () => {
      const parsed = parseSearchQuery("(t:unit");
      expect(parsed.root).toMatchObject({ kind: "clause", key: "type" });
      expect(parsed.diagnostics[0]).toMatchObject({ code: "unbalancedParen" });
    });

    it("reports a stray closing paren", () => {
      const parsed = parseSearchQuery("t:unit)");
      expect(parsed.root).toMatchObject({ kind: "clause", value: "unit)" });
      const stray = parseSearchQuery("t:unit )");
      expect(stray.diagnostics[0]).toMatchObject({ code: "unbalancedParen" });
    });

    it("reports an empty group", () => {
      expect(parseSearchQuery("()").diagnostics[0]).toMatchObject({ code: "emptyGroup" });
    });

    it("reports a dangling or", () => {
      expect(parseSearchQuery("t:unit or").diagnostics[0]).toMatchObject({ code: "danglingOr" });
    });
  });
});

describe("countQueryNodes", () => {
  it("counts every node in the tree", () => {
    expect(countQueryNodes(null)).toBe(0);
    expect(countQueryNodes(parseSearchQuery("a").root)).toBe(1);
    expect(countQueryNodes(parseSearchQuery("a -(b or c)").root)).toBe(6);
  });
});
