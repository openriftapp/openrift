import { describe, expect, it } from "vitest";

import { listImportIssueText } from "./import-flow-shared";

describe("listImportIssueText", () => {
  it("names the line and the unreadable text", () => {
    expect(listImportIssueText({ line: 3, code: "unreadable", text: "broken" })).toBe(
      'Line 3: couldn\'t read "broken", expected "<quantity> <card name>".',
    );
  });

  it("names the line for a zero quantity and a missing name", () => {
    expect(listImportIssueText({ line: 1, code: "zeroQuantity", text: "0 Teemo" })).toBe(
      "Line 1: quantity must be greater than zero.",
    );
    expect(listImportIssueText({ line: 2, code: "missingName", text: "3" })).toBe(
      "Line 2: missing card name.",
    );
  });
});
