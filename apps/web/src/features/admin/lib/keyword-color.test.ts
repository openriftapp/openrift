import { describe, expect, it } from "vitest";

import { validateKeywordColor } from "./keyword-color";

describe("validateKeywordColor", () => {
  it("accepts a six digit hex color", () => {
    expect(validateKeywordColor("#6366f1")).toBeNull();
    expect(validateKeywordColor(" #ABCDEF ")).toBeNull();
  });

  it("rejects a blank color because a style row needs one", () => {
    expect(validateKeywordColor("")).toMatch(/Pick a color/u);
    expect(validateKeywordColor("  ")).toMatch(/Pick a color/u);
  });

  it.each(["red", "#fff", "6366f1", "#12345g"])("rejects %s", (color) => {
    expect(validateKeywordColor(color)).toMatch(/hex code/u);
  });
});
