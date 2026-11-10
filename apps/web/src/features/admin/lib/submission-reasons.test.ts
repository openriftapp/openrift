import { describe, expect, it } from "vitest";

import { canSendRejection } from "./submission-reasons";

describe("canSendRejection", () => {
  it("needs a reason", () => {
    expect(canSendRejection(null, "")).toBe(false);
    expect(canSendRejection(null, "Seen it before")).toBe(false);
  });

  it("accepts a canned reason without a note", () => {
    expect(canSendRejection("duplicate", "")).toBe(true);
  });

  it("needs a non-blank note for the other reason", () => {
    expect(canSendRejection("other", "   ")).toBe(false);
    expect(canSendRejection("other", "Wrong set")).toBe(true);
  });
});
