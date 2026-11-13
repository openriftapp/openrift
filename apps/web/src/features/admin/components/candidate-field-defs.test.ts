import { describe, expect, it } from "vitest";

import { candidateValueText, resolveLabel } from "./candidate-field-defs";

describe("candidateValueText", () => {
  it("shows a dash for an empty string", () => {
    expect(candidateValueText("", undefined)).toBe("—");
  });

  it("appends a non-empty suffix in parentheses", () => {
    expect(candidateValueText("OGN", "Origins")).toBe("OGN (Origins)");
    expect(candidateValueText("OGN", "")).toBe("OGN");
    expect(candidateValueText(null, "Origins")).toBe("— (Origins)");
  });
});

describe("resolveLabel", () => {
  const field = {
    key: "rarity",
    label: "Rarity",
    labeledOptions: [{ value: "epic", label: "Epic" }],
  };

  it("labels known options and keeps unknown ones", () => {
    expect(resolveLabel(field, "epic")).toBe("Epic");
    expect(resolveLabel(field, ["epic", "odd"])).toBe("Epic, odd");
    expect(resolveLabel(field, null)).toBe("—");
  });
});
