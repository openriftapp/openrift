import { describe, expect, it } from "vitest";

import { memberNameEnglish } from "./member-name.js";

describe("memberNameEnglish", () => {
  it("keeps a real name", () => {
    expect(memberNameEnglish(" Ben ")).toBe("Ben");
  });

  it("treats null and empty names alike", () => {
    expect(memberNameEnglish(null)).toBe("Unnamed member");
    expect(memberNameEnglish("")).toBe("Unnamed member");
    expect(memberNameEnglish("", true)).toBe("Former member");
    expect(memberNameEnglish("Ekko", true)).toBe("Former member");
  });
});
