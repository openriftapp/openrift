import { describe, expect, it } from "vitest";

import { memberName } from "./member-name";

describe("memberName", () => {
  it("returns the member's own name", () => {
    expect(memberName("Ashe")).toBe("Ashe");
    expect(memberName("  Ashe  ")).toBe("Ashe");
  });

  it("names a live account without a name as unnamed", () => {
    expect(memberName(null)).toBe("Unnamed member");
    expect(memberName("   ")).toBe("Unnamed member");
    expect(memberName("")).toBe("Unnamed member");
    expect(memberName("", true)).toBe("Former member");
  });

  it("names a closed account as a former member, even with a stored name", () => {
    expect(memberName("Ekko Timewinder", true)).toBe("Former member");
    expect(memberName(null, true)).toBe("Former member");
    expect(memberName(undefined, true)).toBe("Former member");
  });
});
