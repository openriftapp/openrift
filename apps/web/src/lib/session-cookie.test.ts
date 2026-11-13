import { describe, expect, it } from "vitest";

import { hasSessionCookie } from "./session-cookie";

describe("hasSessionCookie", () => {
  it("finds the production session cookie among others", () => {
    expect(hasSessionCookie("theme=dark; __Secure-better-auth.session_token=abc.def")).toBe(true);
  });

  it("finds the dev session cookie", () => {
    expect(hasSessionCookie("better-auth.session_token=abc")).toBe(true);
  });

  it("is false without any cookie", () => {
    expect(hasSessionCookie("")).toBe(false);
  });

  it("ignores other better-auth cookies and an empty session token", () => {
    expect(hasSessionCookie("better-auth.session_data=xyz; better-auth.session_token=")).toBe(
      false,
    );
  });

  it("ignores a cookie whose name only ends in the session token name", () => {
    expect(hasSessionCookie("other-better-auth.session_token=abc")).toBe(false);
  });
});

describe("hasSessionCookie on a missing header", () => {
  it("is false for a request without a cookie header", () => {
    expect(hasSessionCookie(null)).toBe(false);
    expect(hasSessionCookie(undefined)).toBe(false);
  });
});
