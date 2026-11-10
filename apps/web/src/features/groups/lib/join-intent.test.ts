// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

import { forgetJoinIntent, hasJoinIntent, rememberJoinIntent } from "./join-intent";

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("join intent", () => {
  it("remembers intent per group code", () => {
    rememberJoinIntent("abc123");
    expect(hasJoinIntent("abc123")).toBe(true);
    expect(hasJoinIntent("other")).toBe(false);
  });

  it("forgets intent", () => {
    rememberJoinIntent("abc123");
    forgetJoinIntent("abc123");
    expect(hasJoinIntent("abc123")).toBe(false);
  });

  it("reports no intent when storage throws", () => {
    vi.spyOn(globalThis, "sessionStorage", "get").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => rememberJoinIntent("abc123")).not.toThrow();
    expect(hasJoinIntent("abc123")).toBe(false);
    expect(() => forgetJoinIntent("abc123")).not.toThrow();
  });
});
