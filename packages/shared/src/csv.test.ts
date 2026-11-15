import { describe, expect, it } from "vitest";

import { escapeCsvField, unescapeCsvField } from "./csv.js";

describe("escapeCsvField", () => {
  it("leaves a plain value as it is", () => {
    expect(escapeCsvField("Jinx Loose Cannon")).toBe("Jinx Loose Cannon");
    expect(escapeCsvField("")).toBe("");
    expect(escapeCsvField("OGN-001")).toBe("OGN-001");
    expect(escapeCsvField("3")).toBe("3");
    expect(escapeCsvField("'quoted")).toBe("'quoted");
  });

  it("quotes a value with a comma, a newline or a carriage return", () => {
    expect(escapeCsvField("Jinx, Loose Cannon")).toBe('"Jinx, Loose Cannon"');
    expect(escapeCsvField("line one\nline two")).toBe('"line one\nline two"');
    expect(escapeCsvField("line one\rline two")).toBe('"line one\rline two"');
  });

  it("doubles quotes inside a quoted value", () => {
    expect(escapeCsvField('the "Rebel" deck')).toBe('"the ""Rebel"" deck"');
  });

  it("prefixes an apostrophe to a cell starting with =, + or @", () => {
    expect(escapeCsvField("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(escapeCsvField("+1 foil")).toBe("'+1 foil");
    expect(escapeCsvField("+3")).toBe("'+3");
    expect(escapeCsvField("@Teemo")).toBe("'@Teemo");
  });

  it("prefixes a dash cell only when it is not a plain number", () => {
    expect(escapeCsvField("-3")).toBe("-3");
    expect(escapeCsvField("-0.5")).toBe("-0.5");
    expect(escapeCsvField("-.5")).toBe("-.5");
    expect(escapeCsvField("-cmd")).toBe("'-cmd");
    expect(escapeCsvField("-")).toBe("'-");
    expect(escapeCsvField("-1e5")).toBe("'-1e5");
    expect(escapeCsvField("-1,5")).toBe(`"'-1,5"`);
  });

  it("looks past leading spaces, tabs and non-breaking spaces", () => {
    expect(escapeCsvField(" =1+1")).toBe("' =1+1");
    expect(escapeCsvField("\t@x")).toBe("'\t@x");
    expect(escapeCsvField(" =x")).toBe("' =x");
    expect(escapeCsvField(" -3")).toBe(" -3");
    expect(escapeCsvField(" -3")).toBe(" -3");
    expect(escapeCsvField(" plain")).toBe(" plain");
  });

  it("escapes a cell that already starts with an apostrophe and a formula", () => {
    expect(escapeCsvField("'=x")).toBe("''=x");
  });

  it("neutralises before quoting", () => {
    expect(escapeCsvField("=a,b")).toBe(`"'=a,b"`);
  });
});

describe("unescapeCsvField", () => {
  it("strips one apostrophe in front of a neutralised cell", () => {
    expect(unescapeCsvField("'=x")).toBe("=x");
    expect(unescapeCsvField("'-cmd")).toBe("-cmd");
    expect(unescapeCsvField("''@x")).toBe("'@x");
    expect(unescapeCsvField("' +x")).toBe(" +x");
  });

  it("leaves every other cell alone", () => {
    expect(unescapeCsvField("'-3")).toBe("'-3");
    expect(unescapeCsvField("'quoted")).toBe("'quoted");
    expect(unescapeCsvField("=x")).toBe("=x");
    expect(unescapeCsvField("'")).toBe("'");
  });

  it("gives back the original of every escaped cell", () => {
    const values = ["=x", "+x", "@x", "-cmd", "-3", "'=x", "''@x", "'-cmd", "'-3", " =x"];
    for (const value of [...values, "\t-x", "plain", "'plain", ""]) {
      expect(unescapeCsvField(escapeCsvField(value))).toBe(value);
    }
  });
});
