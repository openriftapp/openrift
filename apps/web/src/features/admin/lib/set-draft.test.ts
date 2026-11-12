import { describe, expect, it } from "vitest";

import { parseSetDraft } from "./set-draft";

describe("parseSetDraft", () => {
  it("maps a blank printed total to null", () => {
    expect(parseSetDraft({ name: "Origins", printedTotal: "" })).toEqual({
      name: "Origins",
      printedTotal: null,
    });
    expect(parseSetDraft({ name: "Origins", printedTotal: "  " })).toEqual({
      name: "Origins",
      printedTotal: null,
    });
  });

  it("trims the name and parses the total", () => {
    expect(parseSetDraft({ name: "  Origins ", printedTotal: " 298 " })).toEqual({
      name: "Origins",
      printedTotal: 298,
    });
  });

  it("accepts zero", () => {
    expect(parseSetDraft({ name: "Origins", printedTotal: "0" })).toEqual({
      name: "Origins",
      printedTotal: 0,
    });
  });

  it.each(["-1", "1.5", "12abc", "abc"])("rejects printed total %s", (printedTotal) => {
    expect(parseSetDraft({ name: "Origins", printedTotal })).toHaveProperty("error");
  });

  it("rejects a blank name", () => {
    expect(parseSetDraft({ name: "   ", printedTotal: "5" })).toEqual({
      error: "Name is required",
    });
  });
});
