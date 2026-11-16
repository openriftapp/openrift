import { describe, expect, it } from "vitest";

import { sanitizeRedirect } from "./utils";

describe("sanitizeRedirect", () => {
  it("returns undefined for undefined input", () => {
    expect(sanitizeRedirect()).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(sanitizeRedirect("")).toBeUndefined();
  });

  it("returns a valid relative path", () => {
    expect(sanitizeRedirect("/foo")).toBe("/foo");
  });

  it("drops natively submitted form fields from the target", () => {
    expect(sanitizeRedirect("/profile?currentPassword=x&email=a%40b.c&tab=security")).toBe(
      "/profile?tab=security",
    );
    expect(sanitizeRedirect("/decks?view=grid")).toBe("/decks?view=grid");
  });

  it("returns root path", () => {
    expect(sanitizeRedirect("/")).toBe("/");
  });

  it("rejects protocol-relative URLs", () => {
    expect(sanitizeRedirect("//evil.com")).toBeUndefined();
  });

  it("rejects absolute URLs", () => {
    expect(sanitizeRedirect("http://evil.com")).toBeUndefined();
  });

  it("rejects backslash paths that browsers may normalize to protocol-relative", () => {
    expect(sanitizeRedirect(String.raw`/\evil.com`)).toBeUndefined();
    expect(sanitizeRedirect(String.raw`/\/evil.com`)).toBeUndefined();
    expect(sanitizeRedirect(String.raw`/foo\bar`)).toBeUndefined();
    expect(sanitizeRedirect("/.//evil.com?password=x")).toBe("/");
    expect(sanitizeRedirect("/%2e//evil.com?password=x")).toBe("/");
  });
});
