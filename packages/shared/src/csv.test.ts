import { describe, expect, it } from "vitest";

import { escapeCsvField } from "./csv.js";

describe("escapeCsvField", () => {
  it("leaves a plain value as it is", () => {
    expect(escapeCsvField("Jinx Loose Cannon")).toBe("Jinx Loose Cannon");
    expect(escapeCsvField("")).toBe("");
  });

  it("quotes a value with a comma or a newline", () => {
    expect(escapeCsvField("Jinx, Loose Cannon")).toBe('"Jinx, Loose Cannon"');
    expect(escapeCsvField("line one\nline two")).toBe('"line one\nline two"');
  });

  it("doubles quotes inside a quoted value", () => {
    expect(escapeCsvField('the "Rebel" deck')).toBe('"the ""Rebel"" deck"');
  });
});
