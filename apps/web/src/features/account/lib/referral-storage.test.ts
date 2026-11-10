// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

import { forgetReferral, pendingReferral, rememberReferral } from "./referral-storage";

const CODE = "AbC123xyz789";
const OTHER = "Zzz999yyy888";
const DAY = 24 * 60 * 60 * 1000;

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("referral storage", () => {
  it("remembers a code until it expires", () => {
    rememberReferral(CODE, 0);
    expect(pendingReferral(29 * DAY)).toBe(CODE);
    expect(pendingReferral(31 * DAY)).toBeNull();
  });

  it("keeps the first code while it is unexpired", () => {
    rememberReferral(CODE, 0);
    rememberReferral(OTHER, DAY);
    expect(pendingReferral(DAY)).toBe(CODE);
  });

  it("replaces an expired code", () => {
    rememberReferral(CODE, 0);
    rememberReferral(OTHER, 31 * DAY);
    expect(pendingReferral(31 * DAY)).toBe(OTHER);
  });

  it("forgets the code", () => {
    rememberReferral(CODE, 0);
    forgetReferral();
    expect(pendingReferral(0)).toBeNull();
  });

  it("ignores malformed stored values", () => {
    localStorage.setItem(
      "openrift-pending-referral",
      JSON.stringify({ code: "bad", expiresAt: 1 }),
    );
    expect(pendingReferral(0)).toBeNull();
    localStorage.setItem("openrift-pending-referral", "{not json");
    expect(pendingReferral(0)).toBeNull();
  });

  it("degrades to a no-op when storage throws", () => {
    vi.spyOn(globalThis, "localStorage", "get").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => rememberReferral(CODE, 0)).not.toThrow();
    expect(pendingReferral(0)).toBeNull();
    expect(() => forgetReferral()).not.toThrow();
  });
});
